import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RegisterFaceModal from './RegisterFaceModal';

/**
 * Component tests for RegisterFaceModal
 *
 * Tests cover:
 * - Modal open/close behavior
 * - Camera stream initialization
 * - Face detection flow
 * - Form validation
 * - Error handling
 * - Cleanup on unmount (prevents memory leaks)
 */

// Mock face-api.js
vi.mock('../../utils/faceApi', () => ({
  detectSingleFace: vi.fn(),
  loadModels: vi.fn().mockResolvedValue(undefined),
}));

// Mock api service
vi.mock('../../services/api', () => ({
  api: {
    post: vi.fn().mockResolvedValue({
      data: { _id: 'emp_123', name: 'John Doe' },
    }),
  },
}));

// Mock navigator.mediaDevices
const mockGetUserMedia = vi.fn();
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia,
  },
  writable: true,
});

describe('RegisterFaceModal', () => {
  let queryClient: QueryClient;
  const mockOnClose = vi.fn();
  const mockRefetch = vi.fn();

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    
    mockOnClose.mockClear();
    mockRefetch.mockClear();
    mockGetUserMedia.mockClear();

    // Mock successful camera access
    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    } as any);
  });

  const renderModal = (isOpen = true) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <RegisterFaceModal
          isOpen={isOpen}
          onClose={mockOnClose}
          refetch={mockRefetch}
        />
      </QueryClientProvider>
    );
  };

  it('should render modal when isOpen is true', () => {
    renderModal(true);
    expect(screen.getByText(/Enroll New Face/i)).toBeInTheDocument();
  });

  it('should not render modal when isOpen is false', () => {
    renderModal(false);
    expect(screen.queryByText(/Enroll New Face/i)).not.toBeInTheDocument();
  });

  it('should request camera permissions when modal opens', async () => {
    renderModal(true);

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: { width: 640, height: 480 },
      });
    });
  });

  it('should show error message if camera access denied', async () => {
    mockGetUserMedia.mockRejectedValueOnce(new Error('Permission denied'));

    renderModal(true);

    await waitFor(() => {
      expect(screen.getByText(/Camera access denied/i)).toBeInTheDocument();
    });
  });

  it('should validate name field is required', async () => {
    const user = userEvent.setup();
    renderModal(true);

    const captureButton = screen.getByText(/Capture Face/i);
    await user.click(captureButton);

    await waitFor(() => {
      expect(screen.getByText(/Name is required/i)).toBeInTheDocument();
    });
  });

  it('should validate email format', async () => {
    const user = userEvent.setup();
    renderModal(true);

    const emailInput = screen.getByLabelText(/Email/i);
    await user.type(emailInput, 'invalid-email');

    await waitFor(() => {
      expect(screen.getByText(/Invalid email/i)).toBeInTheDocument();
    });
  });

  it('should stop camera stream when modal closes', async () => {
    const mockStop = vi.fn();
    const mockStream = {
      getTracks: () => [{ stop: mockStop }],
    };
    mockGetUserMedia.mockResolvedValueOnce(mockStream as any);

    const { rerender } = renderModal(true);

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalled();
    });

    // Close modal
    rerender(
      <QueryClientProvider client={queryClient}>
        <RegisterFaceModal
          isOpen={false}
          onClose={mockOnClose}
          refetch={mockRefetch}
        />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(mockStop).toHaveBeenCalled();
    });
  });

  it('should prevent memory leak by stopping stream on unmount', async () => {
    const mockStop = vi.fn();
    const mockStream = {
      getTracks: () => [{ stop: mockStop }],
    };
    mockGetUserMedia.mockResolvedValueOnce(mockStream as any);

    const { unmount } = renderModal(true);

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalled();
    });

    unmount();

    await waitFor(() => {
      expect(mockStop).toHaveBeenCalled();
    });
  });

  it('should call onClose and refetch after successful enrollment', async () => {
    const { detectSingleFace } = await import('../../utils/faceApi');
    const { api } = await import('../../services/api');

    vi.mocked(detectSingleFace).mockResolvedValueOnce({
      descriptor: new Array(128).fill(0.1),
    } as any);

    vi.mocked(api.post).mockResolvedValueOnce({
      data: { _id: 'emp_123', name: 'John Doe' },
    } as any);

    const user = userEvent.setup();
    renderModal(true);

    // Fill form
    const nameInput = screen.getByLabelText(/Name/i);
    const emailInput = screen.getByLabelText(/Email/i);
    await user.type(nameInput, 'John Doe');
    await user.type(emailInput, 'john@example.com');

    // Capture face
    const captureButton = screen.getByText(/Capture Face/i);
    await user.click(captureButton);

    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('should show error toast if face detection fails', async () => {
    const { detectSingleFace } = await import('../../utils/faceApi');

    vi.mocked(detectSingleFace).mockResolvedValueOnce(null);

    const user = userEvent.setup();
    renderModal(true);

    const nameInput = screen.getByLabelText(/Name/i);
    await user.type(nameInput, 'John Doe');

    const captureButton = screen.getByText(/Capture Face/i);
    await user.click(captureButton);

    await waitFor(() => {
      expect(screen.getByText(/No face detected/i)).toBeInTheDocument();
    });
  });

  it('should disable capture button while processing', async () => {
    const user = userEvent.setup();
    renderModal(true);

    const nameInput = screen.getByLabelText(/Name/i);
    await user.type(nameInput, 'John Doe');

    const captureButton = screen.getByText(/Capture Face/i);
    await user.click(captureButton);

    expect(captureButton).toBeDisabled();
  });
});
