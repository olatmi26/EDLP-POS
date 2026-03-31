<?php
namespace App\Http\Requests\Inventory;
use Illuminate\Foundation\Http\FormRequest;
class AdjustInventoryRequest extends FormRequest
{
    public function authorize(): bool { return true; }
    public function rules(): array
    {
        return [
            'product_id' => 'required|integer|exists:products,id',
            'branch_id'  => 'nullable|integer|exists:branches,id',
            'type'       => 'required|in:add,remove,set',
            'quantity'   => 'required|integer|min:0',
            'notes'      => 'nullable|string|max:500',
        ];
    }
}
