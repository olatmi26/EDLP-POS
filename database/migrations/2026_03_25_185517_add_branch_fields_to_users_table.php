<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('branch_id')->nullable()->after('id')
                  ->constrained('branches')->nullOnDelete();
            $table->string('phone', 20)->nullable()->after('email');
            $table->string('pin', 6)->nullable()->after('phone');       // hashed 4-digit PIN for cashiers
            $table->string('profile_photo')->nullable()->after('pin');
            $table->boolean('is_active')->default(true)->after('profile_photo');
            $table->timestamp('last_login_at')->nullable()->after('is_active');

            $table->index('branch_id');
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['branch_id']);
            $table->dropColumn(['branch_id', 'phone', 'pin', 'profile_photo', 'is_active', 'last_login_at']);
        });
    }
};
