<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Category;
use App\Models\Inventory;
use App\Models\Product;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
    }

    private function adminWithBranch(): array
    {
        $branch = Branch::factory()->create();
        $admin  = User::factory()->branchManager()->create(['branch_id' => $branch->id]);
        return [$admin, $branch];
    }

    // ── GET /api/products ─────────────────────────────────────────────────────

    public function test_user_can_list_products(): void
    {
        [$admin, $branch] = $this->adminWithBranch();
        Product::factory()->count(5)->create();

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/products')
            ->assertOk()
            ->assertJsonStructure(['success', 'data', 'meta']);
    }

    // ── GET /api/products/search ──────────────────────────────────────────────

    public function test_pos_search_returns_products_with_stock(): void
    {
        [$admin, $branch] = $this->adminWithBranch();

        $category = Category::factory()->create();
        $product  = Product::factory()->create([
            'name'        => 'Indomie Noodles Test',
            'category_id' => $category->id,
            'is_active'   => true,
        ]);

        Inventory::factory()->create([
            'product_id' => $product->id,
            'branch_id'  => $branch->id,
            'quantity'   => 50,
        ]);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/products/search?q=Indomie')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Indomie Noodles Test']);
    }

    public function test_search_requires_query_parameter(): void
    {
        [$admin] = $this->adminWithBranch();

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/products/search')
            ->assertStatus(422);
    }

    // ── POST /api/products ────────────────────────────────────────────────────

    public function test_manager_can_create_product(): void
    {
        [$admin, $branch] = $this->adminWithBranch();
        $category = Category::factory()->create();

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/products', [
                'name'          => 'Test Product',
                'sku'           => 'TST-SKU-001',
                'cost_price'    => 500,
                'selling_price' => 700,
                'unit'          => 'piece',
                'category_id'   => $category->id,
            ])
            ->assertStatus(201)
            ->assertJsonPath('data.sku', 'TST-SKU-001');

        $this->assertDatabaseHas('products', ['sku' => 'TST-SKU-001']);
    }

    public function test_product_sku_must_be_unique(): void
    {
        [$admin] = $this->adminWithBranch();
        Product::factory()->create(['sku' => 'DUPE-SKU-001']);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/products', [
                'name'          => 'Duplicate SKU',
                'sku'           => 'DUPE-SKU-001',
                'cost_price'    => 100,
                'selling_price' => 150,
                'unit'          => 'piece',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['sku']);
    }

    public function test_cashier_cannot_create_product(): void
    {
        $branch  = Branch::factory()->create();
        $cashier = User::factory()->cashier()->create(['branch_id' => $branch->id]);

        $this->actingAs($cashier, 'sanctum')
            ->postJson('/api/products', [
                'name'          => 'Cashier Product',
                'sku'           => 'CSH-001',
                'cost_price'    => 100,
                'selling_price' => 150,
                'unit'          => 'piece',
            ])
            ->assertStatus(403);
    }

    // ── PUT /api/products/{product} ───────────────────────────────────────────

    public function test_manager_can_update_product_price(): void
    {
        [$admin] = $this->adminWithBranch();
        $product = Product::factory()->create(['selling_price' => 1000]);

        $this->actingAs($admin, 'sanctum')
            ->putJson("/api/products/{$product->id}", ['selling_price' => 1200])
            ->assertOk()
            ->assertJsonPath('data.selling_price', 1200.0);

        // Price change should be recorded in history
        $this->assertDatabaseHas('price_history', [
            'product_id' => $product->id,
            'old_price'  => 1000,
            'new_price'  => 1200,
        ]);
    }

    // ── DELETE /api/products/{product} ────────────────────────────────────────

    public function test_product_without_sales_can_be_deleted(): void
    {
        [$admin] = $this->adminWithBranch();
        $product = Product::factory()->create();

        $this->actingAs($admin, 'sanctum')
            ->deleteJson("/api/products/{$product->id}")
            ->assertOk();

        $this->assertSoftDeleted('products', ['id' => $product->id]);
    }
}
