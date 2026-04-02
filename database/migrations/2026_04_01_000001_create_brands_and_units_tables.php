<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sprint 3 ext — Brands & Units
 *
 * 1. Creates `brands` table
 * 2. Adds `brand_id` FK to `products`
 * 3. Creates `units` table with default EDLP units seeded inline
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── Brands ────────────────────────────────────────────────────────────
        Schema::create('brands', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('slug', 120)->unique();
            $table->text('description')->nullable();
            $table->string('logo_url')->nullable();
            $table->string('website')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['is_active', 'sort_order']);
        });

        // ── Add brand_id to products ──────────────────────────────────────────
        Schema::table('products', function (Blueprint $table) {
            $table->foreignId('brand_id')
                ->nullable()
                ->after('supplier_id')
                ->constrained('brands')
                ->nullOnDelete();
        });

        // ── Units ─────────────────────────────────────────────────────────────
        Schema::create('units', function (Blueprint $table) {
            $table->id();
            $table->string('name', 60);       // Full name: "Kilogram"
            $table->string('short_code', 20)->unique(); // Abbreviation: "kg"
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['is_active', 'sort_order']);
        });

        // Seed default EDLP units
        $now   = now();
        $units = [
            ['name' => 'Piece',       'short_code' => 'pcs',    'description' => 'Individual item / unit',          'sort_order' => 1],
            ['name' => 'Kilogram',    'short_code' => 'kg',     'description' => 'Weight — kilogram',               'sort_order' => 2],
            ['name' => 'Gram',        'short_code' => 'g',      'description' => 'Weight — gram',                   'sort_order' => 3],
            ['name' => 'Litre',       'short_code' => 'L',      'description' => 'Volume — litre',                  'sort_order' => 4],
            ['name' => 'Millilitre',  'short_code' => 'ml',     'description' => 'Volume — millilitre',             'sort_order' => 5],
            ['name' => 'Carton',      'short_code' => 'carton', 'description' => 'Packaged carton (e.g. 12 units)', 'sort_order' => 6],
            ['name' => 'Pack',        'short_code' => 'pack',   'description' => 'Bundled pack',                    'sort_order' => 7],
            ['name' => 'Dozen',       'short_code' => 'doz',    'description' => '12 pieces',                       'sort_order' => 8],
            ['name' => 'Crate',       'short_code' => 'crate',  'description' => 'Wholesale crate',                 'sort_order' => 9],
            ['name' => 'Bag',         'short_code' => 'bag',    'description' => 'Bagged goods (rice, flour etc.)', 'sort_order' => 10],
            ['name' => 'Bottle',      'short_code' => 'btl',    'description' => 'Bottled product',                 'sort_order' => 11],
            ['name' => 'Can',         'short_code' => 'can',    'description' => 'Canned product',                  'sort_order' => 12],
            ['name' => 'Roll',        'short_code' => 'roll',   'description' => 'Rolled product (tissue, foil)',   'sort_order' => 13],
            ['name' => 'Sachet',      'short_code' => 'sachet', 'description' => 'Small sachet / pouch',            'sort_order' => 14],
            ['name' => 'Metre',       'short_code' => 'm',      'description' => 'Length — metre',                  'sort_order' => 15],
        ];

        foreach ($units as $unit) {
            \DB::table('units')->insert(array_merge($unit, [
                'is_active'  => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]));
        }
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropForeignIdFor(\App\Models\Brand::class);
            $table->dropColumn('brand_id');
        });
        Schema::dropIfExists('brands');
        Schema::dropIfExists('units');
    }
};
