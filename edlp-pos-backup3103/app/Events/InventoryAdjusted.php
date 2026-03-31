<?php

namespace App\Events;

use App\Models\Inventory;
use App\Models\User;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class InventoryAdjusted
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly Inventory $inventory,
        public readonly int $before,
        public readonly int $after,
        public readonly string $adjustmentType,
        public readonly ?string $notes,
        public readonly User $adjustedBy,
    ) {}
}
