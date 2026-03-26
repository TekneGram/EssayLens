import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LlmSelector } from '../components/LlmSelector';

describe('LlmSelector', () => {
  it('disables selector when no models are downloaded', () => {
    render(
      <LlmSelector
        downloadedModels={[]}
        activeModelKey={null}
        isSelecting={false}
        onSelect={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const selector = screen.getByTestId('llm-selector-input') as HTMLSelectElement;
    expect(selector.disabled).toBe(true);
    expect(selector.options[0]?.textContent).toBe('No downloaded models available');
  });
});
