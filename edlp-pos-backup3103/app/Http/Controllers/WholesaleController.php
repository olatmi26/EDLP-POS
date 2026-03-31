<?php

namespace App\Http\Controllers;

use App\Models\B2bCustomer;
use App\Models\WholesaleOrder;
use App\Models\WholesalePriceTier;
use App\Services\WholesaleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WholesaleController extends Controller
{
    public function __construct(private readonly WholesaleService $wholesaleService) {}

    // ── B2B Customer CRUD ─────────────────────────────────────────────────────

    public function customerIndex(Request $request): JsonResponse
    {
        $query = B2bCustomer::with(['assignedTo:id,name'])
            ->when($request->tier,    fn ($q, $t) => $q->where('tier', $t))
            ->when($request->search,  fn ($q, $s) => $q->where(fn ($i) =>
                $i->where('business_name', 'LIKE', "%{$s}%")->orWhere('phone', 'LIKE', "%{$s}%")
            ))
            ->when($request->on_hold, fn ($q) => $q->where('on_credit_hold', true))
            ->orderBy('business_name');

        return $this->paginatedSuccess($query->paginate($request->get('per_page', 15)));
    }

    public function customerStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'business_name'  => 'required|string|max:200',
            'cac_number'     => 'nullable|string|unique:b2b_customers,cac_number',
            'contact_person' => 'nullable|string',
            'email'          => 'nullable|email',
            'phone'          => 'nullable|string',
            'address'        => 'nullable|string',
            'tier'           => 'required|in:gold,silver,bronze',
            'credit_limit'   => 'numeric|min:0',
            'payment_terms'  => 'required|in:net30,net60,cod',
        ]);

        $customer = B2bCustomer::create([...$data, 'assigned_to' => $request->user()->id]);
        return $this->created($customer, 'B2B customer created');
    }

    public function customerShow(B2bCustomer $b2bCustomer): JsonResponse
    {
        $b2bCustomer->load(['orders' => fn ($q) => $q->latest()->limit(10), 'payments' => fn ($q) => $q->latest()->limit(5)]);
        return $this->success($b2bCustomer);
    }

    public function customerUpdate(Request $request, B2bCustomer $b2bCustomer): JsonResponse
    {
        $data = $request->validate([
            'business_name' => 'sometimes|string|max:200',
            'tier'          => 'sometimes|in:gold,silver,bronze',
            'credit_limit'  => 'numeric|min:0',
            'payment_terms' => 'sometimes|in:net30,net60,cod',
            'on_credit_hold'=> 'boolean',
            'is_active'     => 'boolean',
        ]);
        $b2bCustomer->update($data);
        return $this->success($b2bCustomer, 'Customer updated');
    }

    public function recordPayment(Request $request, B2bCustomer $b2bCustomer): JsonResponse
    {
        $data = $request->validate([
            'amount'             => 'required|numeric|min:0.01',
            'payment_method'     => 'required|in:bank_transfer,cash,cheque,pos',
            'reference'          => 'nullable|string',
            'wholesale_order_id' => 'nullable|integer|exists:wholesale_orders,id',
            'notes'              => 'nullable|string',
        ]);

        $payment = $this->wholesaleService->recordPayment($b2bCustomer, $data, $request->user());
        return $this->created($payment, 'Payment recorded');
    }

    // ── Wholesale Orders ──────────────────────────────────────────────────────

    public function orderIndex(Request $request): JsonResponse
    {
        $user  = $request->user();
        $query = WholesaleOrder::with(['customer:id,business_name,tier', 'branch:id,name'])
            ->when(! $user->isSuperAdmin() && ! $user->isAdmin(), fn ($q) => $q->where('branch_id', $user->branch_id))
            ->when($request->status,         fn ($q, $s) => $q->where('status', $s))
            ->when($request->payment_status, fn ($q, $s) => $q->where('payment_status', $s))
            ->latest();

        return $this->paginatedSuccess($query->paginate($request->get('per_page', 15)));
    }

    public function orderStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'b2b_customer_id'  => 'required|integer|exists:b2b_customers,id',
            'items'            => 'required|array|min:1',
            'items.*.product_id' => 'required|integer|exists:products,id',
            'items.*.quantity'   => 'required|integer|min:1',
            'notes'            => 'nullable|string',
            'delivery_address' => 'nullable|string',
        ]);

        $data['branch_id'] = $request->user()->branch_id;
        $order = $this->wholesaleService->createOrder($data, $request->user());
        return $this->created($order, 'Wholesale order created — pending approval');
    }

    public function orderShow(WholesaleOrder $wholesaleOrder): JsonResponse
    {
        $wholesaleOrder->load(['customer', 'items.product', 'createdBy:id,name', 'approvalRequest.decisions.decider:id,name', 'payments']);
        return $this->success($wholesaleOrder);
    }

    public function advanceStatus(Request $request, WholesaleOrder $wholesaleOrder): JsonResponse
    {
        $data  = $request->validate(['status' => 'required|string']);
        $order = $this->wholesaleService->advanceStatus($wholesaleOrder, $data['status'], $request->user());
        return $this->success($order, "Order status updated to {$data['status']}");
    }

    public function priceTiers(Request $request): JsonResponse
    {
        $tiers = WholesalePriceTier::with('product:id,name,sku,selling_price')
            ->when($request->product_id, fn ($q, $id) => $q->where('product_id', $id))
            ->get();
        return $this->success($tiers);
    }

    public function updatePriceTiers(Request $request): JsonResponse
    {
        $data = $request->validate([
            'tiers'              => 'required|array',
            'tiers.*.product_id' => 'required|integer|exists:products,id',
            'tiers.*.tier'       => 'required|in:gold,silver,bronze',
            'tiers.*.unit_price' => 'required|numeric|min:0',
            'tiers.*.min_quantity' => 'integer|min:1',
        ]);

        foreach ($data['tiers'] as $tier) {
            WholesalePriceTier::updateOrCreate(
                ['product_id' => $tier['product_id'], 'tier' => $tier['tier']],
                ['unit_price' => $tier['unit_price'], 'min_quantity' => $tier['min_quantity'] ?? 1]
            );
        }

        return $this->success(null, 'Price tiers updated');
    }

    public function agedDebtReport(Request $request): JsonResponse
    {
        $branchId = $request->branch_id ?? $request->user()->branch_id;

        $buckets = ['0_30' => [], '31_60' => [], '61_90' => [], '90_plus' => []];

        $overdueOrders = WholesaleOrder::with('customer:id,business_name')
            ->where('payment_status', '!=', WholesaleOrder::PAYMENT_PAID)
            ->where('status', WholesaleOrder::STATUS_INVOICED)
            ->when(! $request->user()->isSuperAdmin(), fn ($q) => $q->where('branch_id', $branchId))
            ->whereNotNull('due_date')
            ->get();

        foreach ($overdueOrders as $order) {
            $days = today()->diffInDays($order->due_date, false) * -1;
            $bucket = match (true) {
                $days <= 30  => '0_30',
                $days <= 60  => '31_60',
                $days <= 90  => '61_90',
                default      => '90_plus',
            };
            $buckets[$bucket][] = [
                'order_number'  => $order->order_number,
                'customer'      => $order->customer?->business_name,
                'total'         => $order->total,
                'days_overdue'  => $days,
                'due_date'      => $order->due_date,
            ];
        }

        return $this->success($buckets);
    }
}
