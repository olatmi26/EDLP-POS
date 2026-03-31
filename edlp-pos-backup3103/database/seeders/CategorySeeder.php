<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class CategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            'Food & Beverages'    => ['Rice & Grains','Pasta & Noodles','Cooking Oil','Canned Foods','Snacks & Biscuits','Beverages & Drinks','Baby Food','Seasoning & Spices'],
            'Household Supplies'  => ['Cleaning Products','Toiletries & Hygiene','Laundry & Fabric Care','Insecticides & Pest Control'],
            'Personal Care'       => ['Skin Care','Hair Care','Oral Care','Feminine Hygiene'],
            'Dairy & Eggs'        => ['Milk & Yoghurt','Butter & Margarine','Eggs'],
            'Frozen Foods'        => ['Frozen Chicken','Frozen Fish','Frozen Meat'],
            'Fresh Produce'       => ['Vegetables','Fruits','Tubers'],
            'Confectionery'       => ['Sweets & Candy','Chocolate','Gum & Mints'],
            'Stationery'          => ['Pens & Pencils','Notebooks','Office Supplies'],
        ];

        foreach ($categories as $parent => $children) {
            $parentCat = Category::firstOrCreate(
                ['slug' => Str::slug($parent)],
                ['name' => $parent, 'is_active' => true, 'sort_order' => 0]
            );

            foreach ($children as $i => $child) {
                Category::firstOrCreate(
                    ['slug' => Str::slug($child)],
                    ['name' => $child, 'parent_id' => $parentCat->id, 'is_active' => true, 'sort_order' => $i]
                );
            }
        }

        $this->command->info('Categories seeded: 8 top-level + 36 subcategories.');
    }
}
