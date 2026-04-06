<?php

namespace App\Http\Controllers;

use App\Http\Requests\Customer\StoreCustomerRequest;
use App\Http\Requests\Customer\UpdateCustomerRequest;
use App\Http\Resources\CustomerResource;
use App\Models\Customer;
use App\Services\CustomerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    public function __construct(private readonly CustomerService $customerService) {}

    /**
     * GET /api/customers
     */
    public function index(Request $request): JsonResponse
    {
        $user     = $request->user();
        $branchId = $request->branch_id;

        $query = Customer::with('branch')
            ->active()
            ->when($request->search, fn ($q, $s) => $q->search($s))
            ->when(
                ($user->isSuperAdmin() || $user->isAdmin()) && ! $branchId,
                fn ($q) => $q, // all branches — no filter
                fn ($q) => $q->where('branch_id', $branchId)
            )
            ->orderBy('name');

        return $this->paginatedSuccess($query->paginate($request->get('per_page', 20)));
    }

    /**
     * POST /api/customers
     */
    public function store(StoreCustomerRequest $request): JsonResponse
    {
        $customer = Customer::create(array_merge(
            $request->validated(),
            ['branch_id' => $request->branch_id]
        ));

        return $this->created(new CustomerResource($customer), 'Customer created');
    }

    /**
     * GET /api/customers/{customer}
     */
    public function show(Customer $customer): JsonResponse
    {
        $customer->load(['branch', 'sales' => fn ($q) => $q->latest()->limit(10)]);

        return $this->success(new CustomerResource($customer));
    }

    /**
     * PUT /api/customers/{customer}
     */
    public function update(UpdateCustomerRequest $request, Customer $customer): JsonResponse
    {
        $customer->update($request->validated());

        return $this->success(new CustomerResource($customer->fresh('branch')), 'Customer updated');
    }

    /**
     * DELETE /api/customers/{customer}
     */
    public function destroy(Customer $customer): JsonResponse
    {
        $customer->update(['is_active' => false]);

        return $this->success(null, 'Customer deactivated');
    }

    /**
     * POST /api/customers/merge
     */
    public function merge(Request $request): JsonResponse
    {
        $request->validate([
            'primary_id'   => 'required|integer|exists:customers,id',
            'secondary_id' => 'required|integer|exists:customers,id|different:primary_id',
        ]);

        $merged = $this->customerService->merge(
            $request->primary_id,
            $request->secondary_id
        );

        return $this->success(new CustomerResource($merged), 'Customers merged successfully');
    }

    /**
     * GET /api/customers/{customer}/suggestions
     */
    public function suggestions(Customer $customer, Request $request): JsonResponse
    {
        $suggestions = $this->customerService->getSuggestions(
            $customer,
            $request->branch_id
        );

        return $this->success($suggestions);
    }

    /**
     * GET /api/customers/{customer}/purchase-history
     */
    public function purchaseHistory(Customer $customer): JsonResponse
    {
        $history = $customer->aiPurchaseHistory()
            ->with('product.category')
            ->orderByDesc('frequency')
            ->limit(50)
            ->get();

        return $this->success($history);
    }

    /**
     * GET /api/customers/export
     * Export all customers as CSV.
     */
    public function export(Request $request): \Illuminate\Http\Response
    {
        $user     = $request->user();
        $branchId = $request->branch_id;

        $customers = Customer::with('branch')
            ->when(
                ($user->isSuperAdmin() || $user->isAdmin()) && ! $branchId,
                fn ($q) => $q,
                fn ($q) => $q->where('branch_id', $branchId)
            )
            ->orderBy('name')
            ->get();

        $headers = ['name', 'phone', 'email', 'address', 'branch', 'visit_count', 'total_spend', 'rank', 'notes', 'created_at'];

        $rows = $customers->map(fn ($c) => [
            $c->name,
            $c->phone ?? '',
            $c->email ?? '',
            $c->address ?? '',
            $c->branch?->name ?? '',
            $c->visit_count ?? 0,
            number_format((float) $c->total_spend, 2),
            $c->rank ?? '',
            str_replace(["\r", "\n"], ' ', $c->notes ?? ''),
            $c->created_at?->toDateString() ?? '',
        ]);

        $csv = collect([$headers])
            ->concat($rows)
            ->map(fn ($r) => implode(',', array_map(
                fn ($v) => '"' . str_replace('"', '""', (string) $v) . '"', $r
            )))
            ->implode("\n");

        return response($csv, 200, [
            'Content-Type'        => 'text/csv',
            'Content-Disposition' => 'attachment; filename="edlp-customers.csv"',
        ]);
    }

    /**
     * POST /api/customers/import
     * Import customers from CSV.
     * Required columns: name, phone
     * Optional: email, address, notes
     */
    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'file'      => 'required|file|mimes:csv,txt|max:5120',
        ]);

        $branchId = $request->branch_id;
        $file     = $request->file('file');
        $handle   = fopen($file->getRealPath(), 'r');

        // Parse header row
        $rawHeaders = fgetcsv($handle);
        $headers    = array_map(fn ($h) => strtolower(trim($h)), $rawHeaders);

        $colIdx = fn ($name) => array_search($name, $headers);

        $nameIdx    = $colIdx('name');
        $phoneIdx   = $colIdx('phone');
        $emailIdx   = $colIdx('email');
        $addressIdx = $colIdx('address');
        $notesIdx   = $colIdx('notes');

        if ($nameIdx === false) {
            fclose($handle);
            return $this->error('CSV must have a "name" column.', 422);
        }

        $created = 0;
        $updated = 0;
        $skipped = 0;
        $errors  = [];

        while (($row = fgetcsv($handle)) !== false) {
            $name  = trim($row[$nameIdx] ?? '');
            $phone = $phoneIdx !== false ? trim($row[$phoneIdx] ?? '') : null;

            if (! $name) {
                $skipped++;
                continue;
            }

            $data = array_filter([
                'name'      => $name,
                'phone'     => $phone ?: null,
                'email'     => $emailIdx !== false ? (trim($row[$emailIdx] ?? '') ?: null) : null,
                'address'   => $addressIdx !== false ? (trim($row[$addressIdx] ?? '') ?: null) : null,
                'notes'     => $notesIdx !== false ? (trim($row[$notesIdx] ?? '') ?: null) : null,
                'branch_id' => $branchId,
                'is_active' => true,
            ], fn ($v) => $v !== null);

            // Try to find existing by phone
            $existing = $phone
                ? Customer::where('phone', $phone)->where('branch_id', $branchId)->first()
                : null;

            if ($existing) {
                $existing->update($data);
                $updated++;
            } else {
                Customer::create($data);
                $created++;
            }
        }

        fclose($handle);

        return $this->success([
            'created' => $created,
            'updated' => $updated,
            'skipped' => $skipped,
            'errors'  => $errors,
        ], "Import complete: {$created} created, {$updated} updated, {$skipped} skipped.");
    }
}
