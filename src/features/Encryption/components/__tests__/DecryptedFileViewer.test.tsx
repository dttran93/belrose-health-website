// @vitest-environment jsdom
//
// src/features/Encryption/components/__tests__/DecryptedFileViewer.test.tsx
//
// DecryptedFileViewer fetches an encrypted file blob and decrypts it client-side for preview/
// download. EncryptionKeyManager/RecordDecryptionService/EncryptionService are all mocked here —
// their real crypto behavior is already covered by their own dedicated unit/orchestration suites —
// so this test is purely about the component's own state machine: the encrypted vs. unencrypted
// short-circuit, error branches (no session / missing IV / fetch failure), and the file-type
// preview branch (image vs. PDF vs. fallback). jsdom doesn't implement URL.createObjectURL, so it's
// stubbed here.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DecryptedFileViewer } from '../DecryptedFileViewer';

vi.mock('@/features/Encryption/services/encryptionService', () => ({
  EncryptionService: { decryptFile: vi.fn() },
}));

vi.mock('@/features/Encryption/services/encryptionKeyManager', () => ({
  EncryptionKeyManager: { getSessionKey: vi.fn() },
}));

vi.mock('@/features/Encryption/services/recordDecryptionService', () => ({
  RecordDecryptionService: { getRecordKey: vi.fn() },
}));

import { EncryptionService } from '@/features/Encryption/services/encryptionService';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import { RecordDecryptionService } from '@/features/Encryption/services/recordDecryptionService';

const BASE_PROPS = {
  recordId: 'record1',
  downloadURL: 'https://storage.example.com/encrypted-blob',
  fileName: 'lab-results.pdf',
  fileType: 'application/pdf',
  fileSize: 2048,
};

function mockFetchOk() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }),
    })
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:mock-object-url'),
    revokeObjectURL: vi.fn(),
  });
});

describe('DecryptedFileViewer — unencrypted files', () => {
  it('uses the downloadURL directly without attempting decryption', async () => {
    render(<DecryptedFileViewer {...BASE_PROPS} isEncrypted={false} encryptedFileIV={undefined} />);

    expect(await screen.findByText('lab-results.pdf')).toBeInTheDocument();
    expect(EncryptionKeyManager.getSessionKey).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Open/ })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /Download/ })).not.toBeDisabled();
  });
});

describe('DecryptedFileViewer — encrypted files, success path', () => {
  it('decrypts the file and renders the preview once ready', async () => {
    mockFetchOk();
    vi.mocked(EncryptionKeyManager.getSessionKey).mockResolvedValue({} as CryptoKey);
    vi.mocked(RecordDecryptionService.getRecordKey).mockResolvedValue({} as CryptoKey);
    vi.mocked(EncryptionService.decryptFile).mockResolvedValue(new ArrayBuffer(16));

    render(<DecryptedFileViewer {...BASE_PROPS} isEncrypted={true} encryptedFileIV="aXY=" />);

    expect(await screen.findByText('lab-results.pdf')).toBeInTheDocument();
    expect(screen.getByText(/Encrypted/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open/ })).not.toBeDisabled();
    expect(screen.queryByText('Decryption Failed')).not.toBeInTheDocument();
  });

  it('renders a PDF iframe for application/pdf', async () => {
    mockFetchOk();
    vi.mocked(EncryptionKeyManager.getSessionKey).mockResolvedValue({} as CryptoKey);
    vi.mocked(RecordDecryptionService.getRecordKey).mockResolvedValue({} as CryptoKey);
    vi.mocked(EncryptionService.decryptFile).mockResolvedValue(new ArrayBuffer(16));

    const { container } = render(
      <DecryptedFileViewer {...BASE_PROPS} fileType="application/pdf" isEncrypted={true} encryptedFileIV="aXY=" />
    );

    await screen.findByText('lab-results.pdf');
    expect(container.querySelector('iframe')).not.toBeNull();
  });

  it('renders an image preview for image file types', async () => {
    mockFetchOk();
    vi.mocked(EncryptionKeyManager.getSessionKey).mockResolvedValue({} as CryptoKey);
    vi.mocked(RecordDecryptionService.getRecordKey).mockResolvedValue({} as CryptoKey);
    vi.mocked(EncryptionService.decryptFile).mockResolvedValue(new ArrayBuffer(16));

    render(
      <DecryptedFileViewer
        {...BASE_PROPS}
        fileName="scan.png"
        fileType="image/png"
        isEncrypted={true}
        encryptedFileIV="aXY="
      />
    );

    expect(await screen.findByAltText('scan.png')).toBeInTheDocument();
  });

  it('shows the fallback preview for other file types', async () => {
    mockFetchOk();
    vi.mocked(EncryptionKeyManager.getSessionKey).mockResolvedValue({} as CryptoKey);
    vi.mocked(RecordDecryptionService.getRecordKey).mockResolvedValue({} as CryptoKey);
    vi.mocked(EncryptionService.decryptFile).mockResolvedValue(new ArrayBuffer(16));

    render(
      <DecryptedFileViewer
        {...BASE_PROPS}
        fileType="application/octet-stream"
        isEncrypted={true}
        encryptedFileIV="aXY="
      />
    );

    expect(await screen.findByText('Preview not available for this file type')).toBeInTheDocument();
  });
});

describe('DecryptedFileViewer — error paths', () => {
  it('shows a session-not-active error when there is no encryption session', async () => {
    vi.mocked(EncryptionKeyManager.getSessionKey).mockResolvedValue(null);

    render(<DecryptedFileViewer {...BASE_PROPS} isEncrypted={true} encryptedFileIV="aXY=" />);

    expect(await screen.findByText('Decryption Failed')).toBeInTheDocument();
    expect(
      screen.getByText('Encryption session not active. Please unlock your encryption.')
    ).toBeInTheDocument();
  });

  it('shows a missing-IV error when encryptedFileIV is not provided', async () => {
    vi.mocked(EncryptionKeyManager.getSessionKey).mockResolvedValue({} as CryptoKey);
    vi.mocked(RecordDecryptionService.getRecordKey).mockResolvedValue({} as CryptoKey);
    mockFetchOk();

    render(<DecryptedFileViewer {...BASE_PROPS} isEncrypted={true} encryptedFileIV={undefined} />);

    expect(await screen.findByText('Decryption Failed')).toBeInTheDocument();
    expect(screen.getByText('Missing encryption IV for file')).toBeInTheDocument();
  });

  it('shows a fetch-failure error when the encrypted blob request fails', async () => {
    vi.mocked(EncryptionKeyManager.getSessionKey).mockResolvedValue({} as CryptoKey);
    vi.mocked(RecordDecryptionService.getRecordKey).mockResolvedValue({} as CryptoKey);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    render(<DecryptedFileViewer {...BASE_PROPS} isEncrypted={true} encryptedFileIV="aXY=" />);

    expect(await screen.findByText('Decryption Failed')).toBeInTheDocument();
    expect(screen.getByText('Failed to fetch encrypted file')).toBeInTheDocument();
  });

  it('leaves Open/Download disabled while an error is showing', async () => {
    vi.mocked(EncryptionKeyManager.getSessionKey).mockResolvedValue(null);

    render(<DecryptedFileViewer {...BASE_PROPS} isEncrypted={true} encryptedFileIV="aXY=" />);

    await screen.findByText('Decryption Failed');
    expect(screen.getByRole('button', { name: /Open/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Download/ })).toBeDisabled();
  });
});

describe('DecryptedFileViewer — Open button', () => {
  it('opens the decrypted URL in a new tab when clicked', async () => {
    mockFetchOk();
    vi.mocked(EncryptionKeyManager.getSessionKey).mockResolvedValue({} as CryptoKey);
    vi.mocked(RecordDecryptionService.getRecordKey).mockResolvedValue({} as CryptoKey);
    vi.mocked(EncryptionService.decryptFile).mockResolvedValue(new ArrayBuffer(16));
    const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
    const user = userEvent.setup();

    render(<DecryptedFileViewer {...BASE_PROPS} isEncrypted={true} encryptedFileIV="aXY=" />);
    await screen.findByText('lab-results.pdf');

    await user.click(screen.getByRole('button', { name: 'Open' }));

    expect(windowOpen).toHaveBeenCalledWith('blob:mock-object-url', '_blank');
  });
});
