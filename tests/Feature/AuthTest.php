<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
    }

    // ── POST /api/auth/login ──────────────────────────────────────────────────

    public function test_cashier_can_login_with_valid_credentials(): void
    {
        $branch = Branch::factory()->create();
        $user   = User::factory()->cashier()->create([
            'email'     => 'test@edlp.com',
            'password'  => Hash::make('Secret@123'),
            'branch_id' => $branch->id,
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email'    => 'test@edlp.com',
            'password' => 'Secret@123',
        ]);

        $response->assertOk()
            ->assertJsonStructure([
                'success',
                'data' => [
                    'token',
                    'user' => ['id', 'name', 'email', 'branch_id', 'roles'],
                ],
            ])
            ->assertJson(['success' => true]);

        $this->assertNotEmpty($response->json('data.token'));
    }

    public function test_login_fails_with_wrong_password(): void
    {
        $branch = Branch::factory()->create();
        User::factory()->cashier()->create([
            'email'     => 'test@edlp.com',
            'password'  => Hash::make('Correct@123'),
            'branch_id' => $branch->id,
        ]);

        $this->postJson('/api/auth/login', [
            'email'    => 'test@edlp.com',
            'password' => 'Wrong@123',
        ])->assertStatus(401)->assertJson(['success' => false]);
    }

    public function test_login_fails_for_inactive_user(): void
    {
        $branch = Branch::factory()->create();
        User::factory()->cashier()->inactive()->create([
            'email'     => 'inactive@edlp.com',
            'password'  => Hash::make('Secret@123'),
            'branch_id' => $branch->id,
        ]);

        $this->postJson('/api/auth/login', [
            'email'    => 'inactive@edlp.com',
            'password' => 'Secret@123',
        ])->assertStatus(403);
    }

    public function test_login_validates_required_fields(): void
    {
        $this->postJson('/api/auth/login', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['email', 'password']);
    }

    // ── POST /api/auth/login-pin ──────────────────────────────────────────────

    public function test_cashier_can_login_with_pin(): void
    {
        $branch = Branch::factory()->create();
        User::factory()->cashier()->create([
            'staff_id'         => 'STF-0000001',
            'pin'               => Hash::make('1234'),
            'pin_login_enabled' => true,
            'branch_id'         => $branch->id,
        ]);

        $this->postJson('/api/auth/login-pin', [
            'staff_id' => 'STF-0000001',
            'pin'       => '1234',
        ])->assertOk()
          ->assertJsonPath('success', true)
          ->assertJsonStructure(['data' => ['token', 'user']]);
    }

    public function test_pin_login_fails_with_wrong_pin(): void
    {
        $branch = Branch::factory()->create();
        User::factory()->cashier()->create([
            'staff_id'         => 'STF-0000002',
            'pin'               => Hash::make('1234'),
            'pin_login_enabled' => true,
            'branch_id'         => $branch->id,
        ]);

        $this->postJson('/api/auth/login-pin', [
            'staff_id' => 'STF-0000002',
            'pin'       => '9999',
        ])->assertStatus(401);
    }

    // ── GET /api/me ───────────────────────────────────────────────────────────

    public function test_authenticated_user_can_get_their_profile(): void
    {
        $branch = Branch::factory()->create();
        $user   = User::factory()->cashier()->create(['branch_id' => $branch->id]);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('data.id', $user->id)
            ->assertJsonPath('data.email', $user->email);
    }

    public function test_unauthenticated_request_returns_401(): void
    {
        $this->getJson('/api/me')->assertStatus(401);
    }

    // ── DELETE /api/auth/logout ───────────────────────────────────────────────

    public function test_user_can_logout_and_token_is_revoked(): void
    {
        $branch = Branch::factory()->create();
        $user   = User::factory()->cashier()->create(['branch_id' => $branch->id]);

        $token = $user->createToken('test')->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$token}")
            ->deleteJson('/api/auth/logout')
            ->assertOk()
            ->assertJsonPath('success', true);

        // Token should now be revoked
        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/me')
            ->assertStatus(401);
    }

    // ── POST /api/auth/switch-branch ──────────────────────────────────────────

    public function test_super_admin_can_switch_branch(): void
    {
        $hq     = Branch::factory()->create();
        $store  = Branch::factory()->create();
        $admin  = User::factory()->superAdmin()->create(['branch_id' => $hq->id]);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/auth/switch-branch', ['branch_id' => $store->id])
            ->assertOk()
            ->assertJsonPath('data.branch_id', $store->id);
    }

    public function test_cashier_cannot_switch_branch(): void
    {
        $branch1 = Branch::factory()->create();
        $branch2 = Branch::factory()->create();
        $cashier = User::factory()->cashier()->create(['branch_id' => $branch1->id]);

        $this->actingAs($cashier, 'sanctum')
            ->postJson('/api/auth/switch-branch', ['branch_id' => $branch2->id])
            ->assertStatus(403);
    }
}
