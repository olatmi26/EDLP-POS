<?php

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller as BaseController;

abstract class Controller extends BaseController
{
    use AuthorizesRequests, ValidatesRequests;

    // ── Standard JSON response envelope ──────────────────────────────────────

    protected function success(mixed $data = null, string $message = 'OK', int $status = 200): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data'    => $data,
        ], $status);
    }

    protected function created(mixed $data = null, string $message = 'Created'): JsonResponse
    {
        return $this->success($data, $message, 201);
    }

    protected function noContent(): JsonResponse
    {
        return response()->json(null, 204);
    }

    protected function error(string $message, int $status = 400, mixed $errors = null): JsonResponse
    {
        $payload = [
            'success' => false,
            'message' => $message,
        ];

        if ($errors !== null) {
            $payload['errors'] = $errors;
        }

        return response()->json($payload, $status);
    }

    protected function notFound(string $message = 'Resource not found'): JsonResponse
    {
        return $this->error($message, 404);
    }

    protected function forbidden(string $message = 'Forbidden'): JsonResponse
    {
        return $this->error($message, 403);
    }

    protected function validationError(array $errors, string $message = 'Validation failed'): JsonResponse
    {
        return $this->error($message, 422, $errors);
    }

    protected function paginatedSuccess(mixed $paginatedData, string $message = 'OK'): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data'    => $paginatedData->items(),
            'meta'    => [
                'current_page' => $paginatedData->currentPage(),
                'last_page'    => $paginatedData->lastPage(),
                'per_page'     => $paginatedData->perPage(),
                'total'        => $paginatedData->total(),
                'from'         => $paginatedData->firstItem(),
                'to'           => $paginatedData->lastItem(),
            ],
            'links' => [
                'first' => $paginatedData->url(1),
                'last'  => $paginatedData->url($paginatedData->lastPage()),
                'prev'  => $paginatedData->previousPageUrl(),
                'next'  => $paginatedData->nextPageUrl(),
            ],
        ]);
    }
}
