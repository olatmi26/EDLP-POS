<?php

namespace App\Services;

use App\Models\AiPurchaseHistory;
use App\Models\Customer;
use App\Models\Inventory;
use App\Models\Product;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class CustomerService
{
    /**
     * Merge two customer records — primary absorbs secondary.
     */
    public function merge(int $primaryId, int $secondaryId): Customer
    {
        return DB::transaction(function () use ($primaryId, $secondaryId) {
            $primary   = Customer::findOrFail($primaryId);
            $secondary = Customer::findOrFail($secondaryId);

            // Reassign all related records to primary
            $secondary->sales()->update(['customer_id' => $primary->id]);
            $secondary->aiPurchaseHistory()->update(['customer_id' => $primary->id]);

            // Merge counters
            $primary->update([
                'visit_count'  => $primary->visit_count + $secondary->visit_count,
                'total_spend'  => $primary->total_spend + $secondary->total_spend,
                'last_visit_at' => max($primary->last_visit_at, $secondary->last_visit_at),
            ]);

            // Merge AI purchase history frequencies
            $this->consolidateAiHistory($primary->id);

            // Soft-delete the secondary
            $secondary->update(['is_active' => false]);
            $secondary->delete();

            return $primary->fresh();
        });
    }

    /**
     * Get AI product suggestions for POS screen.
     * Combines: customer purchase frequency + in-stock filter.
     * Results cached per customer for 1 hour.
     */
    public function getSuggestions(Customer $customer, int $branchId): array
    {
        $cacheKey = "customer_suggestions:{$customer->id}:{$branchId}";

        return Cache::remember($cacheKey, 3600, function () use ($customer, $branchId) {
            // Get top 10 products this customer buys most
            $frequentProducts = AiPurchaseHistory::where('customer_id', $customer->id)
                ->orderByDesc('frequency')
                ->limit(10)
                ->pluck('product_id')
                ->toArray();

            if (empty($frequentProducts)) {
                // Fall back to best-selling products at the branch
                $frequentProducts = $this->getBranchBestSellers($branchId, 10);
            }

            // Filter to only in-stock products at this branch
            $inStockProductIds = Inventory::where('branch_id', $branchId)
                ->whereIn('product_id', $frequentProducts)
                ->where('quantity', '>', 0)
                ->pluck('product_id')
                ->toArray();

            // Preserve frequency ordering
            $orderedIds = array_values(array_intersect($frequentProducts, $inStockProductIds));

            $products = Product::with('category')
                ->whereIn('id', $orderedIds)
                ->active()
                ->get()
                ->sortBy(fn ($p) => array_search($p->id, $orderedIds))
                ->values();

            return $products->map(fn ($product) => [
                'id'            => $product->id,
                'name'          => $product->name,
                'sku'           => $product->sku,
                'selling_price' => $product->selling_price,
                'thumbnail_url' => $product->thumbnail_url,
                'category'      => $product->category?->name,
            ])->toArray();
        });
    }

    /**
     * Re-consolidate AI purchase history after a merge.
     */
    private function consolidateAiHistory(int $customerId): void
    {
        DB::statement("
            INSERT INTO ai_purchase_history (customer_id, product_id, branch_id, frequency, total_quantity, total_spend, last_purchased_at, created_at, updated_at)
            SELECT customer_id, product_id, branch_id,
                   SUM(frequency), SUM(total_quantity), SUM(total_spend),
                   MAX(last_purchased_at), MIN(created_at), NOW()
            FROM ai_purchase_history
            WHERE customer_id = ?
            GROUP BY customer_id, product_id, branch_id
            ON DUPLICATE KEY UPDATE
                frequency = VALUES(frequency),
                total_quantity = VALUES(total_quantity),
                total_spend = VALUES(total_spend),
                last_purchased_at = VALUES(last_purchased_at),
                updated_at = NOW()
        ", [$customerId]);
    }

    private function getBranchBestSellers(int $branchId, int $limit): array
    {
        return DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sales.branch_id', $branchId)
            ->where('sales.status', 'completed')
            ->groupBy('sale_items.product_id')
            ->orderByRaw('SUM(sale_items.quantity) DESC')
            ->limit($limit)
            ->pluck('sale_items.product_id')
            ->toArray();
    }
}
