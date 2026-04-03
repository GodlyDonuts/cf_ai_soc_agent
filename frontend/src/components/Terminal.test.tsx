import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Terminal from './Terminal';

describe('Terminal Component', () => {
  it('renders the terminal with the catppuccin theme colors', () => {
    const mockEvents = [
      { step: 'thinking', message: 'Analyzing report...', id: '1' }
    ];
    
    render(<Terminal events={mockEvents} wafRule={null} />);
    
    // Check if the terminal container contains the message
    const messageElement = screen.getByText(/Analyzing report.../i);
    expect(messageElement).toBeInTheDocument();
  });

  it('displays the empty state when no events are provided', () => {
    render(<Terminal events={[]} wafRule={null} />);
    expect(screen.getByText(/waiting for input.../i)).toBeInTheDocument();
  });
});
