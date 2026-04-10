import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('vitest smoke test', () => {
  it('renders a simple element and queries it', () => {
    render(<div data-testid="hello">Hello YouFLAC</div>);
    expect(screen.getByTestId('hello')).toHaveTextContent('Hello YouFLAC');
  });
});
