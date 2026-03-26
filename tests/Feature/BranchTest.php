<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BranchTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
    }

    // ── GET /api/branches ─────────────────────────────────────────────────────

    public function test_authenticated_user_can_list_branches(): void
    {
        $branch = Branch::factory()->create();
        $user   = User::factory()->cashier()->create(['branch_id' => $branch->id]);

        Branch::factory()->count(4)->create();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/branches')
            ->assertOk()
            ->assertJsonStructure([
                'success', 'data', 'meta' => ['total'],
            ]);
    }

    public function test_unauthenticated_user_cannot_list_branches(): void
    {
        $this->getJson('/api/branches')->assertStatus(401);
    }

    // ── POST /api/branches ────────────────────────────────────────────────────

    public function test_super_admin_can_create_branch(): void
    {
        $hq    = Branch::factory()->headOffice()->create();
        $admin = User::factory()->superAdmin()->create(['branch_id' => $hq->id]);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/branches', [
                'name'    => 'EDLP Test Branch',
                'code'    => 'TST001',
                'address' => '1 Test Street, Lagos',
            ])
            ->assertStatus(201)
            ->assertJsonPath('data.name', 'EDLP Test Branch')
            ->assertJsonPath('data.code', 'TST001');

        $this->assertDatabaseHas('branches', ['code' => 'TST001']);
    }

    public function test_cashier_cannot_create_branch(): void
    {
        $branch  = Branch::factory()->create();
        $cashier = User::factory()->cashier()->create(['branch_id' => $branch->id]);

        $this->actingAs($cashier, 'sanctum')
            ->postJson('/api/branches', [
                'name'    => 'Unauthorized Branch',
                'code'    => 'UNA001',
                'address' => '1 Test Street, Lagos',
            ])
            ->assertStatus(403);
    }

    public function test_branch_code_must_be_unique(): void
    {
        Branch::factory()->create(['code' => 'DUP001']);
        $hq    = Branch::factory()->headOffice()->create();
        $admin = User::factory()->superAdmin()->create(['branch_id' => $hq->id]);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/branches', [
                'name'    => 'Duplicate Code Branch',
                'code'    => 'DUP001',
                'address' => '1 Test Street, Lagos',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['code']);
    }

    // ── GET /api/branches/{branch}/stats ──────────────────────────────────────

    public function test_branch_stats_endpoint_returns_correct_structure(): void
    {
        $branch = Branch::factory()->create();
        $user   = User::factory()->branchManager()->create(['branch_id' => $branch->id]);

        $this->actingAs($user, 'sanctum')
            ->getJson("/api/branches/{$branch->id}/stats")
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'today_sales',
                    'today_transactions',
                    'active_cashiers',
                    'low_stock_count',
                    'active_users',
                ],
            ]);
    }

    // ── DELETE /api/branches/{branch} ─────────────────────────────────────────

    public function test_head_office_cannot_be_deleted(): void
    {
        $hq    = Branch::factory()->headOffice()->create();
        $admin = User::factory()->superAdmin()->create(['branch_id' => $hq->id]);

        $this->actingAs($admin, 'sanctum')
            ->deleteJson("/api/branches/{$hq->id}")
            ->assertStatus(422);
    }

    public function test_branch_with_active_users_cannot_be_deleted(): void
    {
        $hq       = Branch::factory()->headOffice()->create();
        $admin    = User::factory()->superAdmin()->create(['branch_id' => $hq->id]);
        $store    = Branch::factory()->create();
        User::factory()->cashier()->create(['branch_id' => $store->id, 'is_active' => true]);

        $this->actingAs($admin, 'sanctum')
            ->deleteJson("/api/branches/{$store->id}")
            ->assertStatus(422);
    }
}
