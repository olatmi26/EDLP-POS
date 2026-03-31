<?php

namespace App\Services;

use App\Models\Supplier;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class SupplierService
{
    public function create(array $data): Supplier
    {
        return DB::transaction(function () use ($data) {
            return Supplier::create($data);
        });
    }

    public function update(Supplier $supplier, array $data): Supplier
    {
        return DB::transaction(function () use ($supplier, $data) {
            $supplier->update($data);

            return $supplier->fresh();
        });
    }

    public function delete(Supplier $supplier, User $user): void
    {
        // Soft delete is handled by the model.
        // (User not currently stored since supplier schema doesn't track it.)
        DB::transaction(function () use ($supplier) {
            $supplier->delete();
        });
    }
}

