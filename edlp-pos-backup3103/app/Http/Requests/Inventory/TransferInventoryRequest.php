<?php
namespace App\Http\Requests\Inventory;
use Illuminate\Foundation\Http\FormRequest;
class TransferInventoryRequest extends FormRequest
{
    public function authorize(): bool { return true; }
    public function rules(): array
    {
        return [
            'product_id'     => 'required|integer|exists:products,id',
            'from_branch_id' => 'required|integer|exists:branches,id',
            'to_branch_id'   => 'required|integer|exists:branches,id|different:from_branch_id',
            'quantity'       => 'required|integer|min:1',
            'notes'          => 'nullable|string|max:500',
        ];
    }
}
