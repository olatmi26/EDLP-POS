<?php
namespace App\Http\Requests\Product;
use Illuminate\Foundation\Http\FormRequest;
class StoreProductRequest extends FormRequest
{
    public function authorize(): bool { return true; }
    public function rules(): array
    {
        return [
            'name'          => 'required|string|max:200',
            'sku'           => 'required|string|max:50|unique:products,sku',
            'barcode'       => 'nullable|string|max:50|unique:products,barcode',
            'description'   => 'nullable|string',
            'category_id'   => 'nullable|integer|exists:categories,id',
            'supplier_id'   => 'nullable|integer|exists:suppliers,id',
            'cost_price'    => 'required|numeric|min:0',
            'selling_price' => 'required|numeric|min:0',
            'unit'          => 'nullable|string|max:20',
            'reorder_level' => 'nullable|integer|min:0',
            'is_active'     => 'boolean',
            'is_vat_exempt' => 'boolean',
            'vat_rate'      => 'nullable|numeric|min:0|max:100',
        ];
    }
}
