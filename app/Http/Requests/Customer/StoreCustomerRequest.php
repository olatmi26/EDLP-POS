<?php
namespace App\Http\Requests\Customer;
use Illuminate\Foundation\Http\FormRequest;
class StoreCustomerRequest extends FormRequest
{
    public function authorize(): bool { return true; }
    public function rules(): array
    {
        return [
            'name'    => 'required|string|max:150',
            'phone'   => 'required|string|max:20|unique:customers,phone',
            'email'   => 'nullable|email|max:100',
            'address' => 'nullable|string|max:255',
            'notes'   => 'nullable|string',
        ];
    }
}
