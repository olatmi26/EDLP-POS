<?php

namespace App\Http\Requests\PurchaseOrder;

use Illuminate\Foundation\Http\FormRequest;

class StorePurchaseOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'branch_id'                 => ['nullable', 'integer', 'exists:branches,id'],
            'supplier_id'               => ['required', 'integer', 'exists:suppliers,id'],
            'expected_delivery_date'   => ['nullable', 'date', 'after_or_equal:today'],
            'tax_amount'                => ['nullable', 'numeric', 'min:0'],
            'notes'                     => ['nullable', 'string', 'max:2000'],
            'items'                     => ['required', 'array', 'min:1'],
            'items.*.product_id'       => ['required', 'integer', 'exists:products,id'],
            'items.*.quantity_ordered'=> ['required', 'integer', 'min:1'],
            'items.*.unit_cost'        => ['nullable', 'numeric', 'min:0'],
        ];
    }
}

