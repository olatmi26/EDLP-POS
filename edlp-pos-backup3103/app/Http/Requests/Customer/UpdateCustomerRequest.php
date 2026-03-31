<?php
namespace App\Http\Requests\Customer;
use Illuminate\Foundation\Http\FormRequest;
class UpdateCustomerRequest extends FormRequest
{
    public function authorize(): bool { return true; }
    public function rules(): array
    {
        $id = $this->route('customer')?->id;
        return [
            'name'    => 'sometimes|string|max:150',
            'phone'   => "sometimes|string|max:20|unique:customers,phone,{$id}",
            'email'   => 'nullable|email|max:100',
            'address' => 'nullable|string|max:255',
            'notes'   => 'nullable|string',
        ];
    }
}
