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

        // Example large suppliers
        $dangote = Supplier::firstOrCreate(
            ['name' => 'Dangote Industries Ltd'],
            ['contact_person' => 'Sales Dept', 'phone' => '01-2345678', 'email' => 'sales@dangote.com', 'is_active' => true]
        );
        $dufil = Supplier::firstOrCreate(
            ['name' => 'Dufil Prima Foods Plc'],
            ['contact_person' => 'Trade Desk', 'phone' => '01-3456789', 'email' => 'trade@indomie.com', 'is_active' => true]
        );
        $p_g = Supplier::firstOrCreate(
            ['name' => 'Procter & Gamble'],
            ['contact_person' => 'Corporate Sales', 'phone' => '01-5556622', 'email' => 'info@pg.com', 'is_active' => true]
        );
        $unilever = Supplier::firstOrCreate(
            ['name' => 'Unilever Nigeria'],
            ['contact_person' => 'Trade Sales', 'phone' => '01-4448890', 'email' => 'contact@unilever.com', 'is_active' => true]
        );
        $nestle = Supplier::firstOrCreate(
            ['name' => 'Nestle Nigeria'],
            ['contact_person' => 'Sales Department', 'phone' => '01-6677880', 'email' => 'sales@nestle.com', 'is_active' => true]
        );
        $shoprite = Supplier::firstOrCreate(
            ['name' => 'Shoprite Nigeria'],
            ['contact_person' => 'Category Buyer', 'phone' => '01-8787878', 'email' => 'buyer@megaplaza.com', 'is_active' => true]
        );
        $funmistores = Supplier::firstOrCreate(
            ['name' => 'Funmi Stores'],
            [
                'contact_person' => 'Funmi Manager',
                'phone' => '0803-1234567',
                'email' => 'info@funmistores.com',
                'is_active' => true,
                'address' => 'Mushin, Lagos'
            ]
        );

        $riceId    = Category::where('slug', 'rice-grains')->first()?->id;
        $pastaId   = Category::where('slug', 'pasta-noodles')->first()?->id;
        $oilId     = Category::where('slug', 'cooking-oil')->first()?->id;
        $snackId   = Category::where('slug', 'snacks-biscuits')->first()?->id;
        $bevId     = Category::where('slug', 'beverages-drinks')->first()?->id;
        $cleanId   = Category::where('slug', 'cleaning-products')->first()?->id;
        $toiletId  = Category::where('slug', 'toiletries-hygiene')->first()?->id;
        $laundryId = Category::where('slug', 'laundry-fabric-care')->first()?->id;
        $milkId    = Category::where('slug', 'milk-yoghurt')->first()?->id;
        $cerealId  = Category::where('slug', 'cereals-breakfast')->first()?->id;
        $babyId    = Category::where('slug', 'baby-food')->first()?->id;
        $bakingId  = Category::where('slug', 'baking-products')->first()?->id;
        $frznId    = Category::where('slug', 'frozen-food')->first()?->id;
        $fruitvegId= Category::where('slug', 'fresh-fruits-vegetables')->first()?->id;
        $meatId    = Category::where('slug', 'meat-seafood')->first()?->id;
        $bodyId    = Category::where('slug', 'body-care')->first()?->id;
        $petId     = Category::where('slug', 'pet-products')->first()?->id;
        $spiceId   = Category::where('slug', 'spices-sauces')->first()?->id;
        $homeId    = Category::where('slug', 'home-essentials')->first()?->id;

        $suppliers = [$dangote, $dufil, $unilever, $p_g, $nestle, $shoprite, $funmistores];

        // --- Product seed array with duplicate barcodes removed (barcode must be unique)
        $products = [
            // RICE & GRAINS
            ['name'=>'Dangote Semovita 1kg', 'sku'=>'DAN-SEM-1KG', 'barcode'=>'6001107001', 'cost_price'=>1200, 'selling_price'=>1450, 'unit'=>'bag', 'category_id'=>$riceId, 'supplier_id'=>$dangote->id, 'reorder_level'=>20],
            ['name'=>'Dangote Semovita 2kg', 'sku'=>'DAN-SEM-2KG', 'barcode'=>'6001107002', 'cost_price'=>2300, 'selling_price'=>2750, 'unit'=>'bag', 'category_id'=>$riceId, 'supplier_id'=>$dangote->id, 'reorder_level'=>15],
            ['name'=>'Mama Gold Rice 5kg', 'sku'=>'MGR-5KG', 'barcode'=>'6001109001', 'cost_price'=>6300, 'selling_price'=>7450, 'unit'=>'bag', 'category_id'=>$riceId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>12],
            ['name'=>'Royal Stallion Rice 10kg', 'sku'=>'RSR-10KG', 'barcode'=>'6001108002', 'cost_price'=>12500, 'selling_price'=>14900, 'unit'=>'bag', 'category_id'=>$riceId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>8],
            ['name'=>'Ofada Rice 2kg', 'sku'=>'OFADA-2KG', 'barcode'=>'6001801001', 'cost_price'=>4000, 'selling_price'=>4800, 'unit'=>'bag', 'category_id'=>$riceId, 'supplier_id'=>$dangote->id, 'reorder_level'=>7],
            ['name'=>'Honeywell Semolina 1kg', 'sku'=>'HNWL-SEMO-1KG', 'barcode'=>'6001802002', 'cost_price'=>1050, 'selling_price'=>1200, 'unit'=>'bag', 'category_id'=>$riceId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>15],
            ['name'=>'Golden Penny Semovita 5kg', 'sku'=>'GDPN-SEM-5KG', 'barcode'=>'6001802005', 'cost_price'=>4950, 'selling_price'=>5550, 'unit'=>'bag', 'category_id'=>$riceId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>8],

            // BREAKFAST & CEREALS
            ['name'=>'Kellogg\'s Corn Flakes 500g', 'sku'=>'KEL-CF-500', 'barcode'=>'6002101001', 'cost_price'=>2500, 'selling_price'=>3000, 'unit'=>'box', 'category_id'=>$cerealId, 'supplier_id'=>$nestle->id, 'reorder_level'=>20],
            ['name'=>'Nestle Golden Morn 900g', 'sku'=>'NGLD-MRN-900', 'barcode'=>'6002101002', 'cost_price'=>3500, 'selling_price'=>4100, 'unit'=>'tin', 'category_id'=>$cerealId, 'supplier_id'=>$nestle->id, 'reorder_level'=>20],
            ['name'=>'Quaker Oats 500g', 'sku'=>'QUK-OAT-500', 'barcode'=>'6002101003', 'cost_price'=>1200, 'selling_price'=>1400, 'unit'=>'pack', 'category_id'=>$cerealId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>12],
            ['name'=>'Nasco Cornflakes 350g', 'sku'=>'NASCO-CF-350', 'barcode'=>'6002101004', 'cost_price'=>950, 'selling_price'=>1150, 'unit'=>'box', 'category_id'=>$cerealId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>18],
            ['name'=>'Nestle Milo Cereal 330g', 'sku'=>'NEST-MILO-330G', 'barcode'=>'6002101005', 'cost_price'=>1600, 'selling_price'=>1950, 'unit'=>'box', 'category_id'=>$cerealId, 'supplier_id'=>$nestle->id, 'reorder_level'=>15],
            ['name'=>'Cerelac Maize 400g', 'sku'=>'CRLC-MZ-400', 'barcode'=>'6002101009', 'cost_price'=>2000, 'selling_price'=>2600, 'unit'=>'tin', 'category_id'=>$babyId, 'supplier_id'=>$nestle->id, 'reorder_level'=>10],

            // PASTA & NOODLES
            ['name'=>'Indomie Chicken Flavour 70g', 'sku'=>'IND-CHK-70G', 'barcode'=>'6001201001', 'cost_price'=>150, 'selling_price'=>200, 'unit'=>'pack', 'category_id'=>$pastaId, 'supplier_id'=>$dufil->id, 'reorder_level'=>50],
            ['name'=>'Indomie Super Pack 120g', 'sku'=>'IND-SP-120G', 'barcode'=>'6001201003', 'cost_price'=>280, 'selling_price'=>350, 'unit'=>'pack', 'category_id'=>$pastaId, 'supplier_id'=>$dufil->id, 'reorder_level'=>35],
            ['name'=>'Indomie Onion Chicken 120g', 'sku'=>'IND-ONI-120G', 'barcode'=>'6001201002', 'cost_price'=>250, 'selling_price'=>320, 'unit'=>'pack', 'category_id'=>$pastaId, 'supplier_id'=>$dufil->id, 'reorder_level'=>40],
            ['name'=>'Golden Penny Spaghetti 500g', 'sku'=>'GPS-500G', 'barcode'=>'6001202001', 'cost_price'=>700, 'selling_price'=>950, 'unit'=>'pack', 'category_id'=>$pastaId, 'supplier_id'=>$dufil->id, 'reorder_level'=>20],
            ['name'=>'Dangote Macaroni 500g', 'sku'=>'DAN-MAC-500', 'barcode'=>'6001202003', 'cost_price'=>700, 'selling_price'=>850, 'unit'=>'pack', 'category_id'=>$pastaId, 'supplier_id'=>$dangote->id, 'reorder_level'=>15],
            ['name'=>'Golden Penny Macaroni 1kg', 'sku'=>'GDPN-MAC-1KG', 'barcode'=>'6001202004', 'cost_price'=>1300, 'selling_price'=>1550, 'unit'=>'pack', 'category_id'=>$pastaId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>15],
            ['name'=>'Indomie Box (40 packs)', 'sku'=>'IND-BOX-40', 'barcode'=>'6001201010', 'cost_price'=>5800, 'selling_price'=>7200, 'unit'=>'box', 'category_id'=>$pastaId, 'supplier_id'=>$dufil->id, 'reorder_level'=>5],
            ['name'=>'Minimie Noodles Chicken 70g', 'sku'=>'MINIMIE-70', 'barcode'=>'6001201020', 'cost_price'=>120, 'selling_price'=>165, 'unit'=>'pack', 'category_id'=>$pastaId, 'supplier_id'=>$dufil->id, 'reorder_level'=>35],

            // COOKING OIL & BAKING
            ['name'=>'Kings Vegetable Oil 1L', 'sku'=>'KVO-1L', 'barcode'=>'6001301001', 'cost_price'=>2100, 'selling_price'=>2500, 'unit'=>'bottle', 'category_id'=>$oilId, 'supplier_id'=>$dangote->id, 'reorder_level'=>20],
            ['name'=>'Devon Kings Oil 2L', 'sku'=>'DV-KINGS-2L', 'barcode'=>'6001301005', 'cost_price'=>4100, 'selling_price'=>4800, 'unit'=>'bottle', 'category_id'=>$oilId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>12],
            ['name'=>'Mamador Pure Vegetable Oil 5L', 'sku'=>'MAMADOR-5L', 'barcode'=>'6001301010', 'cost_price'=>9900, 'selling_price'=>12000, 'unit'=>'bottle', 'category_id'=>$oilId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>10],
            ['name'=>'Oris Palm Oil 4L', 'sku'=>'ORIS-POIL-4L', 'barcode'=>'6001302010', 'cost_price'=>5200, 'selling_price'=>6200, 'unit'=>'jar', 'category_id'=>$oilId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>10],
            ['name'=>'Blue Band Margarine 250g', 'sku'=>'BLUEBAND-250', 'barcode'=>'6001303010', 'cost_price'=>650, 'selling_price'=>900, 'unit'=>'pack', 'category_id'=>$bakingId, 'supplier_id'=>$unilever->id, 'reorder_level'=>18],
            ['name'=>'St Louis Sugar 500g', 'sku'=>'STLOUIS-500', 'barcode'=>'6001304010', 'cost_price'=>850, 'selling_price'=>1000, 'unit'=>'pack', 'category_id'=>$bakingId, 'supplier_id'=>$dangote->id, 'reorder_level'=>15],
            ['name'=>'Dangote Sugar 1kg', 'sku'=>'DAN-SUG-1KG', 'barcode'=>'6001304020', 'cost_price'=>1700, 'selling_price'=>2000, 'unit'=>'bag', 'category_id'=>$bakingId, 'supplier_id'=>$dangote->id, 'reorder_level'=>15],

            // SNACKS & BISCUITS
            ['name'=>'Digestive Biscuits 400g', 'sku'=>'DIG-BISC-400', 'barcode'=>'6001401002', 'cost_price'=>800, 'selling_price'=>1000, 'unit'=>'pack', 'category_id'=>$snackId, 'supplier_id'=>$dangote->id, 'reorder_level'=>15],
            ['name'=>'McVities Rich Tea Biscuits', 'sku'=>'MCV-TEA', 'barcode'=>'6001401003', 'cost_price'=>850, 'selling_price'=>1000, 'unit'=>'pack', 'category_id'=>$snackId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>10],
            ['name'=>'Oreo Cookies 54g', 'sku'=>'OREO-54G', 'barcode'=>'6001402002', 'cost_price'=>250, 'selling_price'=>320, 'unit'=>'pack', 'category_id'=>$snackId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>20],
            ['name'=>'Chips More Double Choc 90g', 'sku'=>'CHIPS-DCHOC', 'barcode'=>'6001402101', 'cost_price'=>750, 'selling_price'=>900, 'unit'=>'pack', 'category_id'=>$snackId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>12],
            ['name'=>'Gala Sausage Roll', 'sku'=>'GALA-ROLL', 'barcode'=>'6001403002', 'cost_price'=>200, 'selling_price'=>250, 'unit'=>'piece', 'category_id'=>$snackId, 'supplier_id'=>$dangote->id, 'reorder_level'=>30],
            ['name'=>'Minimie Chin Chin 40g', 'sku'=>'MINIMIE-CC-40', 'barcode'=>'6001404001', 'cost_price'=>100, 'selling_price'=>140, 'unit'=>'pack', 'category_id'=>$snackId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>40],
            ['name'=>'Pringles Sour Cream 165g', 'sku'=>'PRG-SOUR-165', 'barcode'=>'5053990100093', 'cost_price'=>1850, 'selling_price'=>2400, 'unit'=>'can', 'category_id'=>$snackId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>10],
            ['name'=>'Choco Milo 18g Sachet', 'sku'=>'MILO-SACH-18', 'barcode'=>'6001403001', 'cost_price'=>80, 'selling_price'=>100, 'unit'=>'sachet', 'category_id'=>$snackId, 'supplier_id'=>$dangote->id, 'reorder_level'=>50],
            ['name'=>'Bourbon Cream Biscuits 80g', 'sku'=>'BOURBON-80', 'barcode'=>'6001401009', 'cost_price'=>160, 'selling_price'=>210, 'unit'=>'pack', 'category_id'=>$snackId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>15],

            // BEVERAGES
            ['name'=>'Coca-Cola PET 50cl', 'sku'=>'COKE-PET-50', 'barcode'=>'5000112637933', 'cost_price'=>250, 'selling_price'=>350, 'unit'=>'bottle', 'category_id'=>$bevId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>40],
            ['name'=>'Fanta Orange 50cl', 'sku'=>'FANTA-50CL', 'barcode'=>'5000112637935', 'cost_price'=>250, 'selling_price'=>350, 'unit'=>'bottle', 'category_id'=>$bevId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>35],
            ['name'=>'Sprite 50cl', 'sku'=>'SPRITE-50CL', 'barcode'=>'5000112637937', 'cost_price'=>250, 'selling_price'=>350, 'unit'=>'bottle', 'category_id'=>$bevId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>25],
            ['name'=>'Maltina 330ml', 'sku'=>'MALT-MALTINA-33', 'barcode'=>'6001501003', 'cost_price'=>350, 'selling_price'=>450, 'unit'=>'can', 'category_id'=>$bevId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>30],
            ['name'=>'Five Alive Pulpy Orange 1L', 'sku'=>'FIVEALIVE-1L', 'barcode'=>'6001502009', 'cost_price'=>1100, 'selling_price'=>1350, 'unit'=>'bottle', 'category_id'=>$bevId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>12],
            ['name'=>'Nescafe Classic 100g', 'sku'=>'NES-CLS-100', 'barcode'=>'6001504001', 'cost_price'=>2500, 'selling_price'=>3200, 'unit'=>'jar', 'category_id'=>$bevId, 'supplier_id'=>$nestle->id, 'reorder_level'=>10],
            ['name'=>'Peak Milk 170g Tin', 'sku'=>'PEAK-TIN-170', 'barcode'=>'6001503001', 'cost_price'=>900, 'selling_price'=>1150, 'unit'=>'tin', 'category_id'=>$milkId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>20],
            ['name'=>'Cowbell Milk Sachet 15g', 'sku'=>'CBL-SACH-15', 'barcode'=>'6001503002', 'cost_price'=>50, 'selling_price'=>70, 'unit'=>'sachet', 'category_id'=>$milkId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>80],
            ['name'=>'Lipton Yellow Tea 25 bags', 'sku'=>'LIP-YLW-25', 'barcode'=>'6001502001', 'cost_price'=>650, 'selling_price'=>880, 'unit'=>'box', 'category_id'=>$bevId, 'supplier_id'=>$unilever->id, 'reorder_level'=>14],
            ['name'=>'Nestle Pure Life Water 1.5L', 'sku'=>'NSPL-1-5L', 'barcode'=>'6001505010', 'cost_price'=>270, 'selling_price'=>350, 'unit'=>'bottle', 'category_id'=>$bevId, 'supplier_id'=>$nestle->id, 'reorder_level'=>40],
            ['name'=>'Eva Water 75cl', 'sku'=>'EVA-WTR-75CL', 'barcode'=>'6001505001', 'cost_price'=>110, 'selling_price'=>150, 'unit'=>'bottle', 'category_id'=>$bevId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>45],

            // DAIRY, CHEESE & COLD
            ['name'=>'Dano Milk 400g', 'sku'=>'DANO-MILK-400', 'barcode'=>'6001503005', 'cost_price'=>2000, 'selling_price'=>2500, 'unit'=>'tin', 'category_id'=>$milkId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>16],
            ['name'=>'Hollandia Yoghurt 1L', 'sku'=>'HOLL-YOG-1L', 'barcode'=>'6001506011', 'cost_price'=>1200, 'selling_price'=>1450, 'unit'=>'pack', 'category_id'=>$milkId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>15],
            ['name'=>'Blue Boat Full Cream 900g', 'sku'=>'BB-CR-900', 'barcode'=>'6001503010', 'cost_price'=>4300, 'selling_price'=>5000, 'unit'=>'tin', 'category_id'=>$milkId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>7],
            ['name'=>'Cheddar Cheese 250g', 'sku'=>'CHED-CH-250', 'barcode'=>'6002601001', 'cost_price'=>2800, 'selling_price'=>3200, 'unit'=>'pack', 'category_id'=>$milkId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>6],
            ['name'=>'FanIce Ice Cream 70ml', 'sku'=>'FAN-ICE-70', 'barcode'=>'6002601010', 'cost_price'=>100, 'selling_price'=>120, 'unit'=>'cup', 'category_id'=>$frznId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>20],

            // HOUSEHOLD CLEANING & LAUNDRY
            ['name'=>'Omo Detergent 500g', 'sku'=>'OMO-500G', 'barcode'=>'6001601001', 'cost_price'=>900, 'selling_price'=>1100, 'unit'=>'pack', 'category_id'=>$laundryId, 'supplier_id'=>$unilever->id, 'reorder_level'=>20],
            ['name'=>'Omo Detergent 1kg', 'sku'=>'OMO-1KG', 'barcode'=>'6001601002', 'cost_price'=>1700, 'selling_price'=>2100, 'unit'=>'pack', 'category_id'=>$laundryId, 'supplier_id'=>$unilever->id, 'reorder_level'=>20],
            ['name'=>'Ariel Washing Powder 1kg', 'sku'=>'ARL-1KG', 'barcode'=>'6001602002', 'cost_price'=>1900, 'selling_price'=>2250, 'unit'=>'pack', 'category_id'=>$laundryId, 'supplier_id'=>$p_g->id, 'reorder_level'=>12],
            ['name'=>'Sunlight Detergent 800g', 'sku'=>'SUN-800', 'barcode'=>'6001603101', 'cost_price'=>850, 'selling_price'=>1200, 'unit'=>'pack', 'category_id'=>$laundryId, 'supplier_id'=>$unilever->id, 'reorder_level'=>15],
            ['name'=>'Morning Fresh Liquid 500ml', 'sku'=>'MORFRES-500', 'barcode'=>'6001602105', 'cost_price'=>1000, 'selling_price'=>1250, 'unit'=>'bottle', 'category_id'=>$cleanId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>10],
            ['name'=>'Harpic Toilet Cleaner 500ml', 'sku'=>'HRP-500ML', 'barcode'=>'6001603001', 'cost_price'=>1200, 'selling_price'=>1500, 'unit'=>'bottle', 'category_id'=>$cleanId, 'supplier_id'=>$unilever->id, 'reorder_level'=>11],
            ['name'=>'Jik Bleach 2L', 'sku'=>'JIK-BLEACH-2L', 'barcode'=>'6001605102', 'cost_price'=>800, 'selling_price'=>1150, 'unit'=>'bottle', 'category_id'=>$cleanId, 'supplier_id'=>$unilever->id, 'reorder_level'=>12],
            ['name'=>'Dettol Original 250ml', 'sku'=>'DET-ORIG-250', 'barcode'=>'6001604001', 'cost_price'=>1050, 'selling_price'=>1300, 'unit'=>'bottle', 'category_id'=>$cleanId, 'supplier_id'=>$unilever->id, 'reorder_level'=>10],
            ['name'=>'Hypo Bleach 2L', 'sku'=>'HYPO-2L', 'barcode'=>'6001605201', 'cost_price'=>500, 'selling_price'=>750, 'unit'=>'bottle', 'category_id'=>$cleanId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>16],

            // TOILETRIES & HYGIENE
            ['name'=>'Pears Baby Soap 100g', 'sku'=>'PRS-SOAP-100', 'barcode'=>'6001701001', 'cost_price'=>600, 'selling_price'=>750, 'unit'=>'bar', 'category_id'=>$toiletId, 'supplier_id'=>$unilever->id, 'reorder_level'=>22],
            ['name'=>'Lux Beauty Soap 85g', 'sku'=>'LUX-SOAP-85', 'barcode'=>'6001702005', 'cost_price'=>200, 'selling_price'=>290, 'unit'=>'bar', 'category_id'=>$toiletId, 'supplier_id'=>$unilever->id, 'reorder_level'=>22],
            ['name'=>'Imperial Leather Soap 100g', 'sku'=>'IMP-LEA-100', 'barcode'=>'6001703002', 'cost_price'=>220, 'selling_price'=>280, 'unit'=>'bar', 'category_id'=>$toiletId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>15],
            // DUPLICATE BARCODE: 6001702001 ('Dettol Soap 70g' and 'Close Up Toothpaste 75ml')
            ['name'=>'Dettol Soap 70g', 'sku'=>'DET-SOAP-70', 'barcode'=>'6001702001', 'cost_price'=>250, 'selling_price'=>320, 'unit'=>'bar', 'category_id'=>$toiletId, 'supplier_id'=>$unilever->id, 'reorder_level'=>14],
            // Remove the following duplicate, or alter barcode to ensure uniqueness
            //['name'=>'Close Up Toothpaste 75ml', 'sku'=>'CLU-75ML', 'barcode'=>'6001702001', ...]
            ['name'=>'Close Up Toothpaste 75ml', 'sku'=>'CLU-75ML', 'barcode'=>'6001702006', 'cost_price'=>700, 'selling_price'=>900, 'unit'=>'tube', 'category_id'=>$toiletId, 'supplier_id'=>$unilever->id, 'reorder_level'=>24],
            ['name'=>'Oral-B Toothpaste 140g', 'sku'=>'ORALB-140G', 'barcode'=>'6001702010', 'cost_price'=>900, 'selling_price'=>1200, 'unit'=>'tube', 'category_id'=>$toiletId, 'supplier_id'=>$p_g->id, 'reorder_level'=>16],
            ['name'=>'Always Sanitary Pad Regular', 'sku'=>'ALW-REG', 'barcode'=>'6001703001', 'cost_price'=>700, 'selling_price'=>900, 'unit'=>'pack', 'category_id'=>$toiletId, 'supplier_id'=>$p_g->id, 'reorder_level'=>18],
            ['name'=>'Always Ultra Long 7s', 'sku'=>'ALW-ULTRA-7', 'barcode'=>'6001703101', 'cost_price'=>950, 'selling_price'=>1200, 'unit'=>'pack', 'category_id'=>$toiletId, 'supplier_id'=>$p_g->id, 'reorder_level'=>13],
            ['name'=>'Pampers Baby Dry Small 10s', 'sku'=>'PAM-SM-10', 'barcode'=>'6001704001', 'cost_price'=>1800, 'selling_price'=>2200, 'unit'=>'pack', 'category_id'=>$babyId, 'supplier_id'=>$p_g->id, 'reorder_level'=>18],

            // FROZEN FOODS & COLD
            ['name'=>'Chicken Drumsticks 1kg', 'sku'=>'CKN-DRUM-1KG', 'barcode'=>'6001804001', 'cost_price'=>2900, 'selling_price'=>3400, 'unit'=>'pack', 'category_id'=>$meatId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>10],
            ['name'=>'Frozen Labanese Shawarma 600g', 'sku'=>'SHAW-FRZN-600', 'barcode'=>'6001805001', 'cost_price'=>2850, 'selling_price'=>3200, 'unit'=>'pack', 'category_id'=>$frznId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>5],
            ['name'=>'Turkey Wings 1kg', 'sku'=>'TRKY-WINGS-1KG', 'barcode'=>'6001806001', 'cost_price'=>3800, 'selling_price'=>4500, 'unit'=>'pack', 'category_id'=>$meatId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>4],
            ['name'=>'Frozen Sausages 500g', 'sku'=>'FRZ-SAUS-500', 'barcode'=>'6001806100', 'cost_price'=>1800, 'selling_price'=>2300, 'unit'=>'pack', 'category_id'=>$frznId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>6],
            ['name'=>'Frozen Prawns 1kg', 'sku'=>'PRAWN-1KG', 'barcode'=>'6001818001', 'cost_price'=>9600, 'selling_price'=>12200, 'unit'=>'pack', 'category_id'=>$meatId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>8],
            ['name'=>'Yam Fries 1kg', 'sku'=>'YAMFRIES-1KG', 'barcode'=>'6001807001', 'cost_price'=>2100, 'selling_price'=>2450, 'unit'=>'pack', 'category_id'=>$frznId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>4],

            // FRUIT & VEGETABLES
            ['name'=>'Fresh Bananas 1kg', 'sku'=>'BANANA-1KG', 'barcode'=>'6001901001', 'cost_price'=>900, 'selling_price'=>1150, 'unit'=>'bunch', 'category_id'=>$fruitvegId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>15],
            ['name'=>'Tomatoes 1kg', 'sku'=>'TOMATO-1KG', 'barcode'=>'6001901002', 'cost_price'=>1200, 'selling_price'=>1800, 'unit'=>'basket', 'category_id'=>$fruitvegId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>13],
            ['name'=>'Onions 1kg', 'sku'=>'ONION-1KG', 'barcode'=>'6001901003', 'cost_price'=>850, 'selling_price'=>1200, 'unit'=>'basket', 'category_id'=>$fruitvegId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>10],
            ['name'=>'Green Pepper 250g', 'sku'=>'GPEP-250', 'barcode'=>'6001901004', 'cost_price'=>500, 'selling_price'=>700, 'unit'=>'pack', 'category_id'=>$fruitvegId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>8],
            ['name'=>'Irish Potatoes 2kg', 'sku'=>'IPOT-2KG', 'barcode'=>'6001901202', 'cost_price'=>1900, 'selling_price'=>2450, 'unit'=>'bag', 'category_id'=>$fruitvegId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>7],
            ['name'=>'Watermelon (Medium)', 'sku'=>'WMELON-MED', 'barcode'=>'6001901400', 'cost_price'=>1200, 'selling_price'=>1800, 'unit'=>'each', 'category_id'=>$fruitvegId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>4],

            // SPICES, SAUCES & CONDIMENTS
            ['name'=>'Dangote Table Salt 1kg', 'sku'=>'DG-SALT-1KG', 'barcode'=>'6002001001', 'cost_price'=>250, 'selling_price'=>350, 'unit'=>'bag', 'category_id'=>$spiceId, 'supplier_id'=>$dangote->id, 'reorder_level'=>25],
            ['name'=>'Knorr Chicken Cubes 50g', 'sku'=>'KNORR-50', 'barcode'=>'6002002001', 'cost_price'=>250, 'selling_price'=>350, 'unit'=>'pack', 'category_id'=>$spiceId, 'supplier_id'=>$unilever->id, 'reorder_level'=>20],
            ['name'=>'Rajah Curry Powder 100g', 'sku'=>'RAJAH-100', 'barcode'=>'6002003001', 'cost_price'=>500, 'selling_price'=>700, 'unit'=>'tin', 'category_id'=>$spiceId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>15],
            ['name'=>'Heinz Tomato Ketchup 460g', 'sku'=>'HEINZ-KETCH-460G', 'barcode'=>'6002004001', 'cost_price'=>900, 'selling_price'=>1200, 'unit'=>'bottle', 'category_id'=>$spiceId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>10],
            ['name'=>'Power Oil Sachet 70ml', 'sku'=>'PW-OIL-70ML', 'barcode'=>'6002005001', 'cost_price'=>120, 'selling_price'=>180, 'unit'=>'sachet', 'category_id'=>$oilId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>22],
            ['name'=>'Bama Mayonnaise 236ml', 'sku'=>'BAMA-MAYO-236', 'barcode'=>'6002006001', 'cost_price'=>950, 'selling_price'=>1200, 'unit'=>'bottle', 'category_id'=>$spiceId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>11],

            // BABY, MOTHER & CHILD
            ['name'=>'Pampers Baby Dry Small 22s', 'sku'=>'PAM-SM-22', 'barcode'=>'6001704011', 'cost_price'=>3000, 'selling_price'=>3500, 'unit'=>'pack', 'category_id'=>$babyId, 'supplier_id'=>$p_g->id, 'reorder_level'=>10],
            ['name'=>'Johnson Baby Oil 200ml', 'sku'=>'JOHN-OIL-200', 'barcode'=>'6002007001', 'cost_price'=>1200, 'selling_price'=>1500, 'unit'=>'bottle', 'category_id'=>$bodyId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>9],
            ['name'=>'Johnson Baby Lotion 500ml', 'sku'=>'JOHN-LOTION-500', 'barcode'=>'6002007002', 'cost_price'=>1400, 'selling_price'=>1700, 'unit'=>'bottle', 'category_id'=>$bodyId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>8],

            // BATH & BODY CARE
            ['name'=>'Nivea Body Lotion 400ml', 'sku'=>'NIVEA-400ML', 'barcode'=>'6002301001', 'cost_price'=>3000, 'selling_price'=>3400, 'unit'=>'bottle', 'category_id'=>$bodyId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>10],
            ['name'=>'Dettol Hand Sanitizer 50ml', 'sku'=>'DET-SAN-50ML', 'barcode'=>'6002301501', 'cost_price'=>950, 'selling_price'=>1250, 'unit'=>'bottle', 'category_id'=>$toiletId, 'supplier_id'=>$unilever->id, 'reorder_level'=>8],
            ['name'=>'Vaseline Jelly 100ml', 'sku'=>'VAS-JEL-100', 'barcode'=>'6002302001', 'cost_price'=>450, 'selling_price'=>600, 'unit'=>'jar', 'category_id'=>$bodyId, 'supplier_id'=>$unilever->id, 'reorder_level'=>15],

            // PAPER GOODS & HOME ESSENTIALS
            ['name'=>'Rose Plus Toilet Roll (10 pack)', 'sku'=>'ROSE-TR-10P', 'barcode'=>'6002303001', 'cost_price'=>1800, 'selling_price'=>2200, 'unit'=>'pack', 'category_id'=>$homeId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>20],
            ['name'=>'Kleenex Kitchen Towel', 'sku'=>'KLEENEX-KT', 'barcode'=>'6002303002', 'cost_price'=>1000, 'selling_price'=>1200, 'unit'=>'roll', 'category_id'=>$homeId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>8],
            ['name'=>'Fineface Table Napkin', 'sku'=>'FINEFACE-NPK', 'barcode'=>'6002303025', 'cost_price'=>300, 'selling_price'=>450, 'unit'=>'pack', 'category_id'=>$homeId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>10],
            ['name'=>'Baygon Insect Killer 300ml', 'sku'=>'BAY-INST-300', 'barcode'=>'6002304001', 'cost_price'=>850, 'selling_price'=>950, 'unit'=>'bottle', 'category_id'=>$cleanId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>7],

            // PET PRODUCTS (EXAMPLES)
            ['name'=>'Pedigree Dog Food 1kg', 'sku'=>'PED-DOG-1KG', 'barcode'=>'6002501001', 'cost_price'=>2600, 'selling_price'=>3200, 'unit'=>'bag', 'category_id'=>$petId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>5],
            ['name'=>'Friskies Cat Food 400g', 'sku'=>'FRISK-CAT-400', 'barcode'=>'6002501002', 'cost_price'=>800, 'selling_price'=>1050, 'unit'=>'tin', 'category_id'=>$petId, 'supplier_id'=>$shoprite->id, 'reorder_level'=>4],
            // -- add more items by bulk to reach 150
        ];

        // Bulk add more realistic mock products by auto-generate to reach ~150
        $brands = [
            ['name' => 'Bournvita', 'category_id' => $bevId, 'supplier' => $nestle],
            ['name' => 'Ribena', 'category_id' => $bevId, 'supplier' => $shoprite],
            ['name' => 'Capri-Sonne Orange', 'category_id' => $bevId, 'supplier' => $shoprite],
            ['name' => 'Pringles BBQ', 'category_id' => $snackId, 'supplier' => $shoprite],
            ['name' => 'Peak Yoghurt Vanilla', 'category_id' => $milkId, 'supplier' => $nestle],
            ['name' => 'Crest Toothpaste', 'category_id' => $toiletId, 'supplier' => $p_g],
            ['name' => 'Colgate Toothpaste', 'category_id' => $toiletId, 'supplier' => $p_g],
            ['name' => 'Nivea Men Deo Spray', 'category_id' => $bodyId, 'supplier' => $shoprite],
            ['name' => 'Dulux Paint 2.5L', 'category_id' => $homeId, 'supplier' => $shoprite],
            ['name' => 'Sunlight Bar Soap', 'category_id' => $cleanId, 'supplier' => $unilever],
        ];

        $cnt = count($products) + 1;
        for ($i = 0; $i < 90; $i++) {
            // Alternate product types
            $brand = $brands[$i % count($brands)];
            $unit = in_array($brand['category_id'], [$bevId, $milkId]) ? 'bottle' : 'pack';
            $suffix = $cnt + $i;
            $name = $brand['name'] . " ($suffix)";
            $sku  = strtoupper(str_replace([' ', '(', ')', '.'], ['-', '', '', ''], mb_substr($brand['name'],0,10))) . "-$suffix";
            $barcode = '900' . str_pad($suffix, 7, '0', STR_PAD_LEFT);
            $cost  = rand(400, 4000);
            $sell  = $cost + rand(200, 1000);
            $products[] = [
                'name' => $name,
                'sku' => $sku,
                'barcode' => $barcode,
                'cost_price' => $cost,
                'selling_price' => $sell,
                'unit' => $unit,
                'category_id' => $brand['category_id'],
                'supplier_id' => $brand['supplier']->id,
                'reorder_level' => rand(5, 30),
            ];
        }

        // Ensure unique barcodes before seed (in case future code changes)
        $seenBarcodes = [];
        $filteredProducts = [];
        foreach ($products as $prod) {
            if (!isset($seenBarcodes[$prod['barcode']])) {
                $seenBarcodes[$prod['barcode']] = true;
                $filteredProducts[] = $prod;
            } else {
                // If you want to log removed dups, un-comment the next line:
                // $this->command->warn("Duplicate barcode found and skipped: " . $prod['name'] . " with " . $prod['barcode']);
            }
        }
        $products = $filteredProducts;

        // Insert products and inventories
        foreach ($products as $data) {
            $product = Product::firstOrCreate(['sku' => $data['sku']], array_merge($data, ['is_active' => true]));

            // Inventory for each branch
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
