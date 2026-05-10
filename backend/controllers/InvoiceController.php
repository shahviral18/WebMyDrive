<?php
/**
 * InvoiceController — Historical & system invoice management.
 *
 * Routes:
 *   GET    /api/invoices/my                  [auth]       List invoices for logged-in user
 *   GET    /api/invoices/download/:id        [auth]       Stream PDF (own invoices only)
 *   GET    /api/admin/invoices/user/:userId  [adminOnly]  List invoices for any user
 *   POST   /api/admin/invoices               [adminOnly]  Create invoice + upload PDF
 *   PUT    /api/admin/invoices/:id           [adminOnly]  Edit invoice metadata
 *   DELETE /api/admin/invoices/:id           [adminOnly]  Delete invoice record + PDF
 */

declare(strict_types=1);

class InvoiceController
{
    private const UPLOAD_DIR = '/home1/wmdadmin/secure_uploads/invoices';
    private const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB

    // ── User endpoints ────────────────────────────────────────────────────────

    public function myInvoices(Request $req): void
    {
        $userId = (int) ($req->user['userId'] ?? 0);
        if (!$userId) Response::error('Unauthorized', 401);

        $rows = Database::query(
            'SELECT id, invoiceNumber, invoiceDate, paymentDate, expiryDate, renewalDate,
                    planName, itemDetails, baseAmount, gstAmount, totalAmount, currency,
                    status, source, createdAt,
                    CASE WHEN pdfPath IS NOT NULL THEN 1 ELSE 0 END AS hasPdf
             FROM `invoices`
             WHERE userId = :uid
             ORDER BY invoiceDate DESC',
            [':uid' => $userId]
        );

        Response::json(['invoices' => $rows]);
    }

    public function downloadPdf(Request $req): void
    {
        $userId    = (int) ($req->user['userId'] ?? 0);
        $invoiceId = (int) ($req->params['id'] ?? 0);
        if (!$userId || !$invoiceId) Response::error('Unauthorized', 401);

        $row = Database::queryOne(
            'SELECT pdfPath, invoiceNumber, userId FROM `invoices` WHERE id = :id',
            [':id' => $invoiceId]
        );

        if (!$row) Response::error('Invoice not found', 404);

        // Users can only download their own invoices; admins can download any
        $role = $req->user['role'] ?? '';
        $isAdmin = in_array($role, ['ADMIN', 'SUPERADMIN'], true);
        if (!$isAdmin && (int) $row['userId'] !== $userId) {
            Response::error('Forbidden', 403);
        }

        if (empty($row['pdfPath'])) Response::error('No PDF attached to this invoice', 404);

        $path = $row['pdfPath'];
        if (!file_exists($path) || !is_readable($path)) {
            Response::error('PDF file not available', 404);
        }

        $filename = 'Invoice_' . preg_replace('/[^A-Za-z0-9_\-]/', '_', $row['invoiceNumber']) . '.pdf';

        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Content-Length: ' . filesize($path));
        header('Cache-Control: private, no-cache');
        readfile($path);
        exit;
    }

    // ── Admin endpoints ───────────────────────────────────────────────────────

    public function adminListForUser(Request $req): void
    {
        $targetUserId = (int) ($req->params['userId'] ?? 0);
        if (!$targetUserId) Response::error('userId is required', 400);

        $user = Database::queryOne('SELECT id, firstName, lastName, email FROM `User` WHERE id = :id', [':id' => $targetUserId]);
        if (!$user) Response::error('User not found', 404);

        $rows = Database::query(
            'SELECT id, invoiceNumber, invoiceDate, paymentDate, expiryDate, renewalDate,
                    planName, itemDetails, baseAmount, gstAmount, totalAmount, currency,
                    status, source, notes, createdAt,
                    CASE WHEN pdfPath IS NOT NULL THEN 1 ELSE 0 END AS hasPdf
             FROM `invoices`
             WHERE userId = :uid
             ORDER BY invoiceDate DESC',
            [':uid' => $targetUserId]
        );

        Response::json(['user' => $user, 'invoices' => $rows]);
    }

    public function adminCreate(Request $req): void
    {
        $adminId = (int) ($req->user['userId'] ?? 0);
        $body    = $_POST; // multipart/form-data

        $userId        = (int) ($body['userId'] ?? 0);
        $invoiceNumber = trim((string) ($body['invoiceNumber'] ?? ''));
        $invoiceDate   = trim((string) ($body['invoiceDate'] ?? ''));

        if (!$userId)        Response::error('userId is required', 400);
        if (!$invoiceNumber) Response::error('invoiceNumber is required', 400);
        if (!$invoiceDate)   Response::error('invoiceDate is required', 400);

        $user = Database::queryOne('SELECT id FROM `User` WHERE id = :id', [':id' => $userId]);
        if (!$user) Response::error('User not found', 404);

        $pdfPath = $this->handlePdfUpload($userId);

        $id = Database::insert(
            'INSERT INTO `invoices`
             (userId, invoiceNumber, invoiceDate, dueDate, paymentDate, expiryDate, renewalDate,
              planName, itemDetails, baseAmount, gstAmount, totalAmount, currency,
              status, pdfPath, source, notes, createdBy)
             VALUES
             (:userId, :invoiceNumber, :invoiceDate, :dueDate, :paymentDate, :expiryDate, :renewalDate,
              :planName, :itemDetails, :baseAmount, :gstAmount, :totalAmount, :currency,
              :status, :pdfPath, \'MANUAL\', :notes, :createdBy)',
            [
                ':userId'        => $userId,
                ':invoiceNumber' => $invoiceNumber,
                ':invoiceDate'   => $invoiceDate,
                ':dueDate'       => $body['dueDate']     ?: null,
                ':paymentDate'   => $body['paymentDate'] ?: null,
                ':expiryDate'    => $body['expiryDate']  ?: null,
                ':renewalDate'   => $body['renewalDate'] ?: null,
                ':planName'      => $body['planName']    ?: null,
                ':itemDetails'   => $body['itemDetails'] ?: null,
                ':baseAmount'    => isset($body['baseAmount'])  && $body['baseAmount']  !== '' ? (float) $body['baseAmount']  : null,
                ':gstAmount'     => isset($body['gstAmount'])   && $body['gstAmount']   !== '' ? (float) $body['gstAmount']   : null,
                ':totalAmount'   => isset($body['totalAmount']) && $body['totalAmount'] !== '' ? (float) $body['totalAmount'] : null,
                ':currency'      => $body['currency'] ?: 'INR',
                ':status'        => $body['status']   ?: 'PAID',
                ':pdfPath'       => $pdfPath,
                ':notes'         => $body['notes']    ?: null,
                ':createdBy'     => $adminId,
            ]
        );

        $invoice = Database::queryOne('SELECT * FROM `invoices` WHERE id = :id', [':id' => $id]);
        Response::json(['success' => true, 'invoice' => $invoice], 201);
    }

    public function adminUpdate(Request $req): void
    {
        $invoiceId = (int) ($req->params['id'] ?? 0);
        if (!$invoiceId) Response::error('id is required', 400);

        $existing = Database::queryOne('SELECT * FROM `invoices` WHERE id = :id', [':id' => $invoiceId]);
        if (!$existing) Response::error('Invoice not found', 404);

        $body = $req->body;

        // Handle optional new PDF upload (multipart)
        $pdfPath = $existing['pdfPath'];
        if (!empty($_FILES['pdfFile']) && $_FILES['pdfFile']['error'] === UPLOAD_ERR_OK) {
            $newPath = $this->handlePdfUpload((int) $existing['userId']);
            if ($newPath) {
                // Remove old PDF
                if ($existing['pdfPath'] && file_exists($existing['pdfPath'])) {
                    @unlink($existing['pdfPath']);
                }
                $pdfPath = $newPath;
            }
        }

        Database::execute(
            'UPDATE `invoices` SET
                invoiceNumber = :invoiceNumber,
                invoiceDate   = :invoiceDate,
                dueDate       = :dueDate,
                paymentDate   = :paymentDate,
                expiryDate    = :expiryDate,
                renewalDate   = :renewalDate,
                planName      = :planName,
                itemDetails   = :itemDetails,
                baseAmount    = :baseAmount,
                gstAmount     = :gstAmount,
                totalAmount   = :totalAmount,
                currency      = :currency,
                status        = :status,
                pdfPath       = :pdfPath,
                notes         = :notes
             WHERE id = :id',
            [
                ':invoiceNumber' => $body['invoiceNumber'] ?? $existing['invoiceNumber'],
                ':invoiceDate'   => $body['invoiceDate']   ?? $existing['invoiceDate'],
                ':dueDate'       => ($body['dueDate']      ?? $existing['dueDate'])     ?: null,
                ':paymentDate'   => ($body['paymentDate']  ?? $existing['paymentDate']) ?: null,
                ':expiryDate'    => ($body['expiryDate']   ?? $existing['expiryDate'])  ?: null,
                ':renewalDate'   => ($body['renewalDate']  ?? $existing['renewalDate']) ?: null,
                ':planName'      => ($body['planName']     ?? $existing['planName'])    ?: null,
                ':itemDetails'   => ($body['itemDetails']  ?? $existing['itemDetails']) ?: null,
                ':baseAmount'    => isset($body['baseAmount'])  ? ((float) $body['baseAmount'])  : $existing['baseAmount'],
                ':gstAmount'     => isset($body['gstAmount'])   ? ((float) $body['gstAmount'])   : $existing['gstAmount'],
                ':totalAmount'   => isset($body['totalAmount']) ? ((float) $body['totalAmount']) : $existing['totalAmount'],
                ':currency'      => $body['currency'] ?? $existing['currency'],
                ':status'        => $body['status']   ?? $existing['status'],
                ':pdfPath'       => $pdfPath,
                ':notes'         => ($body['notes']   ?? $existing['notes']) ?: null,
                ':id'            => $invoiceId,
            ]
        );

        $invoice = Database::queryOne('SELECT * FROM `invoices` WHERE id = :id', [':id' => $invoiceId]);
        Response::json(['success' => true, 'invoice' => $invoice]);
    }

    public function adminDelete(Request $req): void
    {
        $invoiceId = (int) ($req->params['id'] ?? 0);
        if (!$invoiceId) Response::error('id is required', 400);

        $existing = Database::queryOne('SELECT pdfPath FROM `invoices` WHERE id = :id', [':id' => $invoiceId]);
        if (!$existing) Response::error('Invoice not found', 404);

        // Remove PDF file from disk
        if (!empty($existing['pdfPath']) && file_exists($existing['pdfPath'])) {
            @unlink($existing['pdfPath']);
        }

        Database::execute('DELETE FROM `invoices` WHERE id = :id', [':id' => $invoiceId]);
        Response::json(['success' => true]);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Saves the uploaded `pdfFile` to disk and returns its absolute path,
     * or null if no file was uploaded.
     */
    private function handlePdfUpload(int $userId): ?string
    {
        if (empty($_FILES['pdfFile']) || $_FILES['pdfFile']['error'] !== UPLOAD_ERR_OK) {
            return null;
        }

        $file = $_FILES['pdfFile'];

        if ($file['size'] > self::MAX_PDF_BYTES) {
            Response::error('PDF file exceeds 10 MB limit', 400);
        }

        $mime = mime_content_type($file['tmp_name']) ?: '';
        if ($mime !== 'application/pdf') {
            Response::error('Only PDF files are accepted', 400);
        }

        $dir = self::UPLOAD_DIR . '/' . $userId;
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }

        $dest = $dir . '/' . bin2hex(random_bytes(8)) . '.pdf';
        if (!@move_uploaded_file($file['tmp_name'], $dest)) {
            Response::error('Failed to save uploaded file', 500);
        }
        @chmod($dest, 0644);

        return $dest;
    }
}
