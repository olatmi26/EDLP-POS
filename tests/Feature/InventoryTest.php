<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Inventory;
use App\Models\Product;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InventoryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
    }

    // ── GET /api/inventory ────────────────────────────────────────────────────

    public function test_manager_can_view_branch_inventory(): void
    {
        $branch  = Branch::factory()->create();
        $manager = User::factory()->branchManager()->create(['branch_id' => $branch->id]);
        Inventory::factory()->count(5)->create(['branch_id' => $branch->id]);

        $this->actingAs($manager, 'sanctum')
            ->getJson('/api/inventory')
            ->assertOk()
            ->assertJsonStructure(['success', 'data', 'meta']);
    }

    // ── POST /api/inventory/adjust ────────────────────────────────────────────

    public function test_manager_can_add_stock(): void
    {
        $branch   = Branch::factory()->create();
        $manager  = User::factory()->branchManager()->create(['branch_id' => $branch->id]);
        $product  = Product::factory()->create();
        $inventory = Inventory::factory()->create([
            'product_id' => $product->id,
            'branch_id'  => $branch->id,
            'quantity'   => 10,
        ]);

        $this->actingAs($manager, 'sanctum')
            ->postJson('/api/inventory/adjust', [
                'product_id' => $product->id,
                'type'       => 'add',
                'quantity'   => 20,
                'notes'      => 'Stock delivery received',
            ])
            ->assertOk()
            ->assertJsonPath('data.quantity', 30);

        $this->assertDatabaseHas('inventories', [
            'product_id' => $product->id,
            'branch_id'  => $branch->id,
            'quantity'   => 30,
        ]);
    }

    public function test_manager_can_set_stock_to_exact_value(): void
    {
        $branch  = Branch::factory()->create();
        $manager = User::factory()->branchManager()->create(['branch_id' => $branch->id]);
        $product = Product::factory()->create();
        Inventory::factory()->create([
            'product_id' => $product->id,
            'branch_id'  => $branch->id,
            'quantity'   => 100,
        ]);

        $this->actingAs($manager, 'sanctum')
            ->postJson('/api/inventory/adjust', [
                'product_id' => $product->id,
                'type'       => 'set',
                'quantity'   => 45,
            ])
            ->assertOk()
            ->assertJsonPath('data.quantity', 45);
    }

    public function test_cashier_cannot_adjust_inventory(): void
    {
        $branch  = Branch::factory()->create();
        $cashier = User::factory()->cashier()->create(['branch_id' => $branch->id]);
        $product = Product::factory()->create();

        $this->actingAs($cashier, 'sanctum')
            ->postJson('/api/inventory/adjust', [
                'product_id' => $product->id,
                'type'       => 'add',
                'quantity'   => 10,
            ])
            ->assertStatus(403);
    }

    // ── POST /api/inventory/transfer ─────────────────────────────────────────

    public function test_manager_can_request_transfer(): void
    {
        $fromBranch = Branch::factory()->create();
        $toBranch   = Branch::factory()->create();
        $manager    = User::factory()->branchManager()->create(['branch_id' => $fromBranch->id]);
        $product    = Product::factory()->create(['reorder_level' => 5]);

        Inventory::factory()->create([
            'product_id' => $product->id,
            'branch_id'  => $fromBranch->id,
            'quantity'   => 50,
        ]);

        Inventory::factory()->create([
            'product_id' => $product->id,
            'branch_id'  => $toBranch->id,
            'quantity'   => 0,
        ]);

        $this->actingAs($manager, 'sanctum')
            ->postJson('/api/inventory/transfer', [
                'product_id'     => $product->id,
                'from_branch_id' => $fromBranch->id,
                'to_branch_id'   => $toBranch->id,
                'quantity'       => 10,
            ])
            ->assertStatus(201)
            ->assertJsonPath('data.status', 'pending');
    }

    public function test_transfer_fails_when_insufficient_stock(): void
    {
        $fromBranch = Branch::factory()->create();
        $toBranch   = Branch::factory()->create();
        $manager    = User::factory()->branchManager()->create(['branch_id' => $fromBranch->id]);
        $product    = Product::factory()->create();

        Inventory::factory()->create([
            'product_id' => $product->id,
            'branch_id'  => $fromBranch->id,
            'quantity'   => 5,
        ]);

        $this->actingAs($manager, 'sanctum')
            ->postJson('/api/inventory/transfer', [
                'product_id'     => $product->id,
                'from_branch_id' => $fromBranch->id,
                'to_branch_id'   => $toBranch->id,
                'quantity'       => 100,
            ])
            ->assertStatus(500); // InventoryService throws RuntimeException
    }

    // ── GET /api/inventory/low-stock ─────────────────────────────────────────

    public function test_low_stock_endpoint_returns_correct_items(): void
    {
        $branch  = Branch::factory()->create();
        $manager = User::factory()->branchManager()->create(['branch_id' => $branch->id]);

        $lowStockProduct = Product::factory()->create(['reorder_level' => 10]);
        Inventory::factory()->create([
            'product_id' => $lowStockProduct->id,
            'branch_id'  => $branch->id,
            'quantity'   => 3,
        ]);

        $this->actingAs($manager, 'sanctum')
            ->getJson('/api/inventory/low-stock')
            ->assertOk()
            ->assertJsonFragment(['product_id' => $lowStockProduct->id]);
    }
}
