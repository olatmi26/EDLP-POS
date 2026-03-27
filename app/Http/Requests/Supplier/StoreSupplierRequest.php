<?php

namespace App\Http\Requests\Supplier;

use Illuminate\Foundation\Http\FormRequest;

class StoreSupplierRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name'            => ['required', 'string', 'max:255'],
            'company_name'   => ['nullable', 'string', 'max:255'],
            'contact_person' => ['nullable', 'string', 'max:255'],
            'email'          => ['nullable', 'email', 'max:255'],
            'phone'          => ['nullable', 'string', 'max:20'],
            'phone_alt'      => ['nullable', 'string', 'max:20'],
            'address'        => ['nullable', 'string'],
            'city'           => ['nullable', 'string', 'max:255'],
            'state'          => ['nullable', 'string', 'max:255'],
            'notes'          => ['nullable', 'string'],
            'is_active'      => ['boolean'],
        ];
    }
}

