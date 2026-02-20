import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toolbar } from '../../components/Toolbar';

describe('Toolbar', () => {
  it('renders all 8 tools', () => {
    render(<Toolbar activeTool="select" onToolChange={() => {}} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(8);
  });

  it('highlights the active tool', () => {
    render(<Toolbar activeTool="rectangle" onToolChange={() => {}} />);

    const rectangleBtn = screen.getByTitle('Square (R)');
    expect(rectangleBtn).toHaveStyle({ background: '#4285f4' });
  });

  it('shows correct title with keyboard shortcut for each tool', () => {
    render(<Toolbar activeTool="select" onToolChange={() => {}} />);

    expect(screen.getByTitle('Select (V)')).toBeInTheDocument();
    expect(screen.getByTitle('Drag (H)')).toBeInTheDocument();
    expect(screen.getByTitle('Sticky Note (N)')).toBeInTheDocument();
    expect(screen.getByTitle('Square (R)')).toBeInTheDocument();
    expect(screen.getByTitle('Circle (C)')).toBeInTheDocument();
    expect(screen.getByTitle('Line (L)')).toBeInTheDocument();
    expect(screen.getByTitle('Connector (A)')).toBeInTheDocument();
    expect(screen.getByTitle('Text Box (T)')).toBeInTheDocument();
  });

  it('calls onToolChange with correct tool id when clicked', () => {
    const onToolChange = vi.fn();
    render(<Toolbar activeTool="select" onToolChange={onToolChange} />);

    fireEvent.click(screen.getByTitle('Square (R)'));
    expect(onToolChange).toHaveBeenCalledWith('rectangle');

    fireEvent.click(screen.getByTitle('Circle (C)'));
    expect(onToolChange).toHaveBeenCalledWith('circle');

    fireEvent.click(screen.getByTitle('Line (L)'));
    expect(onToolChange).toHaveBeenCalledWith('line');

    fireEvent.click(screen.getByTitle('Connector (A)'));
    expect(onToolChange).toHaveBeenCalledWith('arrow');
  });

  it('calls onToolChange for pan tool', () => {
    const onToolChange = vi.fn();
    render(<Toolbar activeTool="select" onToolChange={onToolChange} />);

    fireEvent.click(screen.getByTitle('Drag (H)'));
    expect(onToolChange).toHaveBeenCalledWith('pan');
  });

  it('calls onToolChange for text tool', () => {
    const onToolChange = vi.fn();
    render(<Toolbar activeTool="select" onToolChange={onToolChange} />);

    fireEvent.click(screen.getByTitle('Text Box (T)'));
    expect(onToolChange).toHaveBeenCalledWith('text');
  });

  it('non-active tools have transparent background', () => {
    render(<Toolbar activeTool="select" onToolChange={() => {}} />);

    const lineBtn = screen.getByTitle('Line (L)');
    expect(lineBtn).toHaveStyle({ background: 'transparent' });
  });
});
