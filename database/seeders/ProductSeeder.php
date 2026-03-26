<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Category;
use App\Models\Inventory;
use App\Models\Product;
use App\Models\Supplier;
use Illuminate\Database\Seeder;

class ProductSeeder extends Seeder
{
    public function run(): void
    {
        $branches = Branch::active()->pluck('id');

        // Seed 2 suppliers
        $dangote = Supplier::firstOrCreate(
            ['name' => 'Dangote Industries Ltd'],
            ['contact_person' => 'Sales Dept', 'phone' => '01-2345678', 'email' => 'sales@dangote.com', 'is_active' => true]
        );
        $dufil = Supplier::firstOrCreate(
            ['name' => 'Dufil Prima Foods Plc'],
            ['contact_person' => 'Trade Desk', 'phone' => '01-3456789', 'email' => 'trade@indomie.com', 'is_active' => true]
        );

        $riceId  = Category::where('slug', 'rice-grains')->first()?->id;
        $pastaId = Category::where('slug', 'pasta-noodles')->first()?->id;
        $oilId   = Category::where('slug', 'cooking-oil')->first()?->id;
        $snackId = Category::where('slug', 'snacks-biscuits')->first()?->id;
        $bevId   = Category::where('slug', 'beverages-drinks')->first()?->id;
        $cleanId = Category::where('slug', 'cleaning-products')->first()?->id;
        $toiletId= Category::where('slug', 'toiletries-hygiene')->first()?->id;
        $laundryId=Category::where('slug', 'laundry-fabric-care')->first()?->id;
        $milkId  = Category::where('slug', 'milk-yoghurt')->first()?->id;

        $products = [
            // Rice & Grains
            ['name' => 'Dangote Semovita 1kg',      'sku' => 'DAN-SEM-1KG', 'barcode' => '6001107001',  'cost_price' => 1200, 'selling_price' => 1450, 'unit' => 'bag',  'category_id' => $riceId,  'supplier_id' => $dangote->id, 'reorder_level' => 20],
            ['name' => 'Dangote Semovita 2kg',      'sku' => 'DAN-SEM-2KG', 'barcode' => '6001107002',  'cost_price' => 2300, 'selling_price' => 2750, 'unit' => 'bag',  'category_id' => $riceId,  'supplier_id' => $dangote->id, 'reorder_level' => 15],
            ['name' => 'Royal Stallion Rice 5kg',   'sku' => 'RSR-5KG',     'barcode' => '6001108001',  'cost_price' => 6500, 'selling_price' => 7800, 'unit' => 'bag',  'category_id' => $riceId,  'supplier_id' => $dangote->id, 'reorder_level' => 10],
            ['name' => 'Royal Stallion Rice 10kg',  'sku' => 'RSR-10KG',    'barcode' => '6001108002',  'cost_price' => 12500,'selling_price' => 14900,'unit' => 'bag',  'category_id' => $riceId,  'supplier_id' => $dangote->id, 'reorder_level' => 10],
            ['name' => 'Mama Gold Rice 5kg',        'sku' => 'MGR-5KG',     'barcode' => '6001109001',  'cost_price' => 6200, 'selling_price' => 7500, 'unit' => 'bag',  'category_id' => $riceId,  'supplier_id' => $dangote->id, 'reorder_level' => 10],
            ['name' => 'Dangote Flour 1kg',         'sku' => 'DAN-FLR-1KG', 'barcode' => '6001110001',  'cost_price' => 900,  'selling_price' => 1100, 'unit' => 'bag',  'category_id' => $riceId,  'supplier_id' => $dangote->id, 'reorder_level' => 20],
            // Pasta & Noodles
            ['name' => 'Indomie Chicken Flavour 70g','sku' => 'IND-CHK-70G','barcode' => '6001201001',  'cost_price' => 150,  'selling_price' => 200,  'unit' => 'pack', 'category_id' => $pastaId, 'supplier_id' => $dufil->id,   'reorder_level' => 50],
            ['name' => 'Indomie Onion Chicken 120g', 'sku' => 'IND-ONI-120G','barcode' => '6001201002', 'cost_price' => 250,  'selling_price' => 320,  'unit' => 'pack', 'category_id' => $pastaId, 'supplier_id' => $dufil->id,   'reorder_level' => 40],
            ['name' => 'Indomie Box (40 packs)',    'sku' => 'IND-BOX-40',  'barcode' => '6001201010',  'cost_price' => 5800, 'selling_price' => 7200, 'unit' => 'box',  'category_id' => $pastaId, 'supplier_id' => $dufil->id,   'reorder_level' => 5],
            ['name' => 'Golden Penny Spaghetti 500g','sku' => 'GPS-500G',   'barcode' => '6001202001',  'cost_price' => 700,  'selling_price' => 900,  'unit' => 'pack', 'category_id' => $pastaId, 'supplier_id' => $dufil->id,   'reorder_level' => 20],
            ['name' => 'Golden Penny Spaghetti 1kg','sku' => 'GPS-1KG',    'barcode' => '6001202002',  'cost_price' => 1300, 'selling_price' => 1650, 'unit' => 'pack', 'category_id' => $pastaId, 'supplier_id' => $dufil->id,   'reorder_level' => 15],
            // Cooking Oil
            ['name' => 'Kings Vegetable Oil 1L',    'sku' => 'KVO-1L',      'barcode' => '6001301001',  'cost_price' => 2100, 'selling_price' => 2500, 'unit' => 'bottle','category_id' => $oilId,   'supplier_id' => $dangote->id, 'reorder_level' => 15],
            ['name' => 'Kings Vegetable Oil 2L',    'sku' => 'KVO-2L',      'barcode' => '6001301002',  'cost_price' => 4000, 'selling_price' => 4800, 'unit' => 'bottle','category_id' => $oilId,   'supplier_id' => $dangote->id, 'reorder_level' => 10],
            ['name' => 'Kings Vegetable Oil 5L',    'sku' => 'KVO-5L',      'barcode' => '6001301003',  'cost_price' => 9500, 'selling_price' => 11500,'unit' => 'bottle','category_id' => $oilId,   'supplier_id' => $dangote->id, 'reorder_level' => 8],
            ['name' => 'Tafi Palm Oil 1L',          'sku' => 'TAFI-1L',     'barcode' => '6001302001',  'cost_price' => 1800, 'selling_price' => 2200, 'unit' => 'bottle','category_id' => $oilId,   'supplier_id' => $dangote->id, 'reorder_level' => 15],
            // Snacks
            ['name' => 'Pringles Original 165g',    'sku' => 'PRG-ORI-165',  'barcode' => '5053990100091','cost_price'=> 1800,'selling_price' => 2200,'unit' => 'can',  'category_id' => $snackId, 'supplier_id' => $dangote->id, 'reorder_level' => 10],
            ['name' => 'Digestive Biscuits 400g',   'sku' => 'DIG-BISC-400','barcode' => '6001401002',  'cost_price' => 800,  'selling_price' => 1000, 'unit' => 'pack', 'category_id' => $snackId, 'supplier_id' => $dangote->id, 'reorder_level' => 15],
            ['name' => 'Gala Sausage Roll (each)',  'sku' => 'GALA-EACH',   'barcode' => '6001402001',  'cost_price' => 200,  'selling_price' => 250,  'unit' => 'piece','category_id' => $snackId, 'supplier_id' => $dangote->id, 'reorder_level' => 30],
            ['name' => 'Choco Milo 18g Sachet',     'sku' => 'MILO-SACH-18','barcode' => '6001403001',  'cost_price' => 80,   'selling_price' => 100,  'unit' => 'sachet','category_id' => $snackId,'supplier_id' => $dangote->id, 'reorder_level' => 50],
            // Beverages
            ['name' => 'Coca-Cola 60cl',            'sku' => 'CKE-60CL',    'barcode' => '5000112637922','cost_price'=> 300, 'selling_price' => 400,  'unit' => 'bottle','category_id' => $bevId,   'supplier_id' => $dangote->id, 'reorder_level' => 30],
            ['name' => 'Malt (Peak) 33cl',          'sku' => 'PEAK-MALT-33','barcode' => '6001501002',  'cost_price' => 350,  'selling_price' => 450,  'unit' => 'can',  'category_id' => $bevId,   'supplier_id' => $dangote->id, 'reorder_level' => 24],
            ['name' => 'Lipton Yellow Tea 25 bags', 'sku' => 'LIP-YLW-25',  'barcode' => '6001502001',  'cost_price' => 500,  'selling_price' => 650,  'unit' => 'box',  'category_id' => $bevId,   'supplier_id' => $dangote->id, 'reorder_level' => 20],
            ['name' => 'Peak Milk 170g Tin',        'sku' => 'PEAK-TIN-170','barcode' => '6001503001',  'cost_price' => 900,  'selling_price' => 1100, 'unit' => 'tin',  'category_id' => $milkId,  'supplier_id' => $dangote->id, 'reorder_level' => 15],
            ['name' => 'Cowbell Milk Sachet 15g',   'sku' => 'CBL-SACH-15', 'barcode' => '6001503002',  'cost_price' => 50,   'selling_price' => 70,   'unit' => 'sachet','category_id' => $milkId, 'supplier_id' => $dangote->id, 'reorder_level' => 100],
            ['name' => 'Nescafe Classic 100g',      'sku' => 'NES-CLS-100', 'barcode' => '6001504001',  'cost_price' => 2500, 'selling_price' => 3000, 'unit' => 'jar',  'category_id' => $bevId,   'supplier_id' => $dangote->id, 'reorder_level' => 10],
            // Household / Cleaning
            ['name' => 'Omo Detergent 500g',        'sku' => 'OMO-500G',    'barcode' => '6001601001',  'cost_price' => 900,  'selling_price' => 1100, 'unit' => 'pack', 'category_id' => $laundryId,'supplier_id' => $dangote->id,'reorder_level' => 20],
            ['name' => 'Omo Detergent 1kg',         'sku' => 'OMO-1KG',     'barcode' => '6001601002',  'cost_price' => 1700, 'selling_price' => 2100, 'unit' => 'pack', 'category_id' => $laundryId,'supplier_id' => $dangote->id,'reorder_level' => 15],
            ['name' => 'Ariel Washing Powder 500g', 'sku' => 'ARL-500G',    'barcode' => '6001602001',  'cost_price' => 950,  'selling_price' => 1200, 'unit' => 'pack', 'category_id' => $laundryId,'supplier_id' => $dangote->id,'reorder_level' => 15],
            ['name' => 'Harpic Toilet Cleaner 500ml','sku'=> 'HRP-500ML',   'barcode' => '6001603001',  'cost_price' => 1200, 'selling_price' => 1500, 'unit' => 'bottle','category_id' => $cleanId, 'supplier_id' => $dangote->id,'reorder_level' => 10],
            ['name' => 'Dettol Original 250ml',     'sku' => 'DET-250ML',   'barcode' => '6001604001',  'cost_price' => 1100, 'selling_price' => 1400, 'unit' => 'bottle','category_id' => $cleanId, 'supplier_id' => $dangote->id,'reorder_level' => 10],
            // Toiletries
            ['name' => 'Pears Baby Soap 100g',      'sku' => 'PRS-SOAP-100','barcode' => '6001701001',  'cost_price' => 600,  'selling_price' => 750,  'unit' => 'bar',  'category_id' => $toiletId,'supplier_id' => $dangote->id, 'reorder_level' => 20],
            ['name' => 'Close Up Toothpaste 75ml',  'sku' => 'CLU-75ML',    'barcode' => '6001702001',  'cost_price' => 700,  'selling_price' => 900,  'unit' => 'tube', 'category_id' => $toiletId,'supplier_id' => $dangote->id, 'reorder_level' => 15],
            ['name' => 'Always Sanitary Pad Regular','sku'=> 'ALW-REG',     'barcode' => '6001703001',  'cost_price' => 700,  'selling_price' => 900,  'unit' => 'pack', 'category_id' => $toiletId,'supplier_id' => $dangote->id, 'reorder_level' => 20],
            ['name' => 'Pampers Baby Dry Small 10s','sku' => 'PAM-SM-10',   'barcode' => '6001704001',  'cost_price' => 1800, 'selling_price' => 2200, 'unit' => 'pack', 'category_id' => $toiletId,'supplier_id' => $dangote->id, 'reorder_level' => 10],
        ];

        foreach ($products as $data) {
            $product = Product::firstOrCreate(['sku' => $data['sku']], array_merge($data, ['is_active' => true]));

            // Create inventory row for every branch
            foreach ($branches as $branchId) {
                Inventory::firstOrCreate(
                    ['product_id' => $product->id, 'branch_id' => $branchId],
                    ['quantity' => rand(20, 200), 'reserved_quantity' => 0]
                );
            }
        }

        $this->command->info(count($products) . ' products seeded with inventory for all branches.');
    }
}
