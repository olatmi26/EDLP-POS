<?php

namespace App\Services;

use App\Models\B2bCustomer;
use App\Models\B2bPayment;
use App\Models\Inventory;
use App\Models\WholesaleOrder;
use App\Models\WholesaleOrderItem;
use App\Models\WholesalePriceTier;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class WholesaleService
{
    public function __construct(
        private readonly ApprovalWorkflowService $approvalService
    ) {}

    /**
     * Resolve the wholesale price for a product given a customer's tier.
     */
    public function resolvePrice(int $productId, string $tier): float
    {
        $tierPrice = WholesalePriceTier::priceFor($productId, $tier);
        if ($tierPrice !== null) return (float) $tierPrice;

        // Fall back to retail selling_price
        return (float) (\App\Models\Product::find($productId)?->selling_price ?? 0);
    }

    /**
     * Create a wholesale order (draft → confirmed → approval if above threshold).
     */
    public function createOrder(array $data, User $createdBy): WholesaleOrder
    {
        return DB::transaction(function () use ($data, $createdBy) {
            $customer = B2bCustomer::findOrFail($data['b2b_customer_id']);

            if ($customer->on_credit_hold) {
                throw new \RuntimeException('This customer is on credit hold. Resolve outstanding balance before placing new orders.');
            }

            $items     = $data['items'] ?? [];
            $subtotal  = 0.0;
            $prepItems = [];

            foreach ($items as $item) {
                $unitPrice = $this->resolvePrice($item['product_id'], $customer->tier);
                $lineTotal = round($unitPrice * $item['quantity'], 2);
                $subtotal += $lineTotal;

                $prepItems[] = [
                    'product_id'   => $item['product_id'],
                    'quantity'     => $item['quantity'],
                    'unit_price'   => $unitPrice,
                    'line_total'   => $lineTotal,
                    'tier_applied' => $customer->tier,
                ];
            }

            $taxAmount = round($subtotal * 0.075, 2); // 7.5% VAT
            $total     = round($subtotal + $taxAmount, 2);

            $order = WholesaleOrder::create([
                'order_number'   => WholesaleOrder::generateOrderNumber($data['branch_id'] ?? $createdBy->branch_id),
                'b2b_customer_id'=> $customer->id,
                'branch_id'      => $data['branch_id'] ?? $createdBy->branch_id,
                'created_by'     => $createdBy->id,
                'status'         => WholesaleOrder::STATUS_CONFIRMED,
                'subtotal'       => $subtotal,
                'tax_amount'     => $taxAmount,
                'total'          => $total,
                'payment_status' => WholesaleOrder::PAYMENT_UNPAID,
                'due_date'       => $this->calculateDueDate($customer->payment_terms),
                'notes'          => $data['notes'] ?? null,
                'delivery_address' => $data['delivery_address'] ?? $customer->address,
            ]);

            foreach ($prepItems as $item) {
                $order->items()->create($item);
            }

            // Route through approval if above configurable threshold
            $approvalRequest = $this->approvalService->initiate(
                operationType: 'wholesale_order',
                operationId:   $order->id,
                requestedBy:   $createdBy,
                context:       ['total' => $total, 'customer' => $customer->business_name, 'tier' => $customer->tier],
                branchId:      $order->branch_id,
            );

            $order->update(['approval_request_id' => $approvalRequest->id]);

            return $order->load(['customer', 'items.product', 'approvalRequest']);
        });
    }

    /**
     * Advance order through lifecycle stages.
     */
    public function advanceStatus(WholesaleOrder $order, string $newStatus, User $by): WholesaleOrder
    {
        $allowedTransitions = [
            WholesaleOrder::STATUS_CONFIRMED  => [WholesaleOrder::STATUS_PICKING],
            WholesaleOrder::STATUS_PICKING    => [WholesaleOrder::STATUS_DISPATCHED],
            WholesaleOrder::STATUS_DISPATCHED => [WholesaleOrder::STATUS_DELIVERED],
            WholesaleOrder::STATUS_DELIVERED  => [WholesaleOrder::STATUS_INVOICED],
        ];

        if (! in_array($newStatus, $allowedTransitions[$order->status] ?? [])) {
            throw new \RuntimeException("Cannot transition from {$order->status} to {$newStatus}.");
        }

        return DB::transaction(function () use ($order, $newStatus, $by) {
            $updates = ['status' => $newStatus];

            if ($newStatus === WholesaleOrder::STATUS_DISPATCHED) {
                // Deduct inventory on dispatch
                foreach ($order->items as $item) {
                    Inventory::where('product_id', $item->product_id)
                        ->where('branch_id', $order->branch_id)
                        ->decrement('quantity', $item->quantity);
                }
                $updates['dispatched_at'] = now();
                // Debit customer outstanding balance
                $order->customer->increment('outstanding_balance', $order->total);
            }

            if ($newStatus === WholesaleOrder::STATUS_DELIVERED) $updates['delivered_at'] = now();
            if ($newStatus === WholesaleOrder::STATUS_INVOICED)  $updates['invoiced_at']  = now();

            $order->update($updates);
            return $order->fresh(['customer', 'items.product']);
        });
    }

    /**
     * Record a payment from a B2B customer.
     */
    public function recordPayment(B2bCustomer $customer, array $data, User $recordedBy): B2bPayment
    {
        return DB::transaction(function () use ($customer, $data, $recordedBy) {
            $payment = B2bPayment::create([
                'b2b_customer_id'    => $customer->id,
                'wholesale_order_id' => $data['wholesale_order_id'] ?? null,
                'amount'             => $data['amount'],
                'payment_method'     => $data['payment_method'],
                'reference'          => $data['reference'] ?? null,
                'notes'              => $data['notes'] ?? null,
                'recorded_by'        => $recordedBy->id,
                'paid_at'            => now(),
            ]);

            // Reduce outstanding balance
            $customer->decrement('outstanding_balance', $data['amount']);

            // Update order payment status if linked
            if (! empty($data['wholesale_order_id'])) {
                $order = WholesaleOrder::find($data['wholesale_order_id']);
                if ($order) {
                    $totalPaid = $order->payments()->sum('amount');
                    $order->update([
                        'payment_status' => $totalPaid >= $order->total
                            ? WholesaleOrder::PAYMENT_PAID
                            : WholesaleOrder::PAYMENT_PARTIAL,
                    ]);
                }
            }

            // Lift credit hold if balance is now within limit
            if ($customer->outstanding_balance < $customer->credit_limit) {
                $customer->update(['on_credit_hold' => false]);
            }

            return $payment;
        });
    }

    // ── Private ────────────────────────────────────────────────────────────────

    private function calculateDueDate(string $paymentTerms): ?\Carbon\Carbon
    {
        return match ($paymentTerms) {
            'net30' => now()->addDays(30),
            'net60' => now()->addDays(60),
            default => null, // COD — no due date
        };
    }
}
