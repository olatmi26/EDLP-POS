<?php

namespace App\DTOs;

abstract class BaseDTO
{
    /**
     * Create a new DTO instance from an array.
     */
    public static function fromArray(array $data): static
    {
        return new static();
    }

    /**
     * Convert the DTO instance to an array.
     */
    public function toArray(): array
    {
        return (array) $this;
    }
}