<?php

namespace App\Services;

use App\Models\Inventory;
use App\Models\PriceHistory;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use League\Csv\Reader;

class ProductService
{
    /**
     * Create a new product and seed inventory rows for all branches.
     */
    public function create(array $data): Product
    {
        return DB::transaction(function () use ($data) {
            $product = Product::create($data);

            // Seed a zero-stock inventory row for every active branch
            $branches = \App\Models\Branch::active()->pluck('id');

            foreach ($branches as $branchId) {
                Inventory::firstOrCreate(
                    ['product_id' => $product->id, 'branch_id' => $branchId],
                    ['quantity' => 0, 'reserved_quantity' => 0]
                );
            }

            return $product;
        });
    }

    /**
     * Update product, recording a price history entry if price changed.
     */
    public function update(Product $product, array $data, User $changedBy): Product
    {
        return DB::transaction(function () use ($product, $data, $changedBy) {
            $oldPrice = (float) $product->selling_price;

            $product->update($data);

            $newPrice = (float) $product->fresh()->selling_price;

            if ($oldPrice !== $newPrice) {
                PriceHistory::create([
                    'product_id'   => $product->id,
                    'changed_by'   => $changedBy->id,
                    'old_price'    => $oldPrice,
                    'new_price'    => $newPrice,
                    'change_type'  => 'manual',
                    'effective_at' => now(),
                ]);
            }

            return $product->fresh();
        });
    }

    /**
     * Bulk price update — either fixed amounts or percentage adjustments.
     *
     * Expected data format:
     * [
     *   'type'     => 'fixed' | 'percentage',
     *   'value'    => float,            // percentage value e.g. 10 = 10% increase
     *   'products' => [id, id, ...]     // optional — omit to apply to category
     *   'category_id' => int,           // optional
     * ]
     */
    public function bulkPriceUpdate(array $data, User $changedBy): int
    {
        $query = Product::query();

        if (! empty($data['products'])) {
            $query->whereIn('id', $data['products']);
        } elseif (! empty($data['category_id'])) {
            $query->where('category_id', $data['category_id']);
        }

        $products = $query->get();
        $updated  = 0;

        DB::transaction(function () use ($products, $data, $changedBy, &$updated) {
            foreach ($products as $product) {
                $oldPrice = (float) $product->selling_price;
                $newPrice = $data['type'] === 'percentage'
                    ? round($oldPrice * (1 + ($data['value'] / 100)), 2)
                    : round((float) $data['value'], 2);

                if ($oldPrice === $newPrice) {
                    continue;
                }

                $product->update(['selling_price' => $newPrice]);

                PriceHistory::create([
                    'product_id'   => $product->id,
                    'changed_by'   => $changedBy->id,
                    'old_price'    => $oldPrice,
                    'new_price'    => $newPrice,
                    'change_type'  => 'bulk_' . $data['type'],
                    'change_reason' => $data['reason'] ?? null,
                    'effective_at' => now(),
                ]);

                $updated++;
            }
        });

        return $updated;
    }

    /**
     * Import products from a CSV file.
     * Expected columns: name, sku, barcode, category, supplier, cost_price, selling_price, unit, reorder_level
     */
    public function importFromCsv(UploadedFile $file, User $importedBy): array
    {
        $csv = Reader::createFromPath($file->getRealPath(), 'r');
        $csv->setHeaderOffset(0);

        $imported = 0;
        $skipped  = 0;
        $errors   = [];

        DB::transaction(function () use ($csv, &$imported, &$skipped, &$errors) {
            foreach ($csv->getRecords() as $row) {
                try {
                    $name = trim($row['name'] ?? '');
                    $sku  = trim($row['sku'] ?? '');

                    if (empty($name) || empty($sku)) {
                        $skipped++;
                        continue;
                    }

                    Product::updateOrCreate(
                        ['sku' => $sku],
                        [
                            'name'          => $name,
                            'barcode'       => trim($row['barcode'] ?? ''),
                            'cost_price'    => (float) ($row['cost_price'] ?? 0),
                            'selling_price' => (float) ($row['selling_price'] ?? 0),
                            'unit'          => trim($row['unit'] ?? 'unit'),
                            'reorder_level' => (int) ($row['reorder_level'] ?? 5),
                            'is_active'     => true,
                        ]
                    );

                    $imported++;
                } catch (\Throwable $e) {
                    $skipped++;
                    $errors[] = "Row skipped: " . $e->getMessage();
                }
            }
        });

        return compact('imported', 'skipped', 'errors');
    }
}
