<?php

namespace App\Http\Requests\PurchaseOrder;

use Illuminate\Foundation\Http\FormRequest;

class StorePurchaseOrderRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'branch_id'              => ['nullable', 'integer', 'exists:branches,id'],
            'supplier_id'            => ['required', 'integer', 'exists:suppliers,id'],
            // Removed 'after_or_equal:today' — empty string from frontend was failing validation
            'expected_delivery_date' => ['nullable', 'date'],
            'tax_amount'             => ['nullable', 'numeric', 'min:0'],
            'notes'                  => ['nullable', 'string', 'max:2000'],
            'items'                  => ['required', 'array', 'min:1'],
            'items.*.product_id'     => ['required', 'integer', 'exists:products,id'],
            'items.*.quantity_ordered' => ['required', 'integer', 'min:1'],
            'items.*.unit_cost'      => ['nullable', 'numeric', 'min:0'],
        ];
    }

    public function messages(): array
    {
        return [
            'supplier_id.required'              => 'Please select a supplier.',
            'items.required'                    => 'Add at least one line item.',
            'items.min'                         => 'Add at least one line item.',
            'items.*.product_id.required'       => 'Select a product for each line item.',
            'items.*.quantity_ordered.required' => 'Enter quantity for each line item.',
        ];
    }

    protected function prepareForValidation(): void
    {
        // Coerce empty string dates to null so 'nullable|date' passes cleanly
        if ($this->expected_delivery_date === '') {
            $this->merge(['expected_delivery_date' => null]);
        }
    }
}
