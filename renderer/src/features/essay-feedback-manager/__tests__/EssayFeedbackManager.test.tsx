import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import EssayFeedbackManager from '../components/EssayFeedbackManager';

describe('EssayFeedbackManager', () => {
  it('renders the essay feedback checklist table with the expected defaults', () => {
    render(<EssayFeedbackManager />);

    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'LLM feedback process' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Explanation' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Select' })).toBeTruthy();

    expect(screen.getByRole('row', { name: /Identify Paragraphs/ })).toBeTruthy();
    expect(screen.getByRole('row', { name: /Thesis statement feedback/ })).toBeTruthy();
    expect(screen.getByRole('row', { name: /Summarize main idea/ })).toBeTruthy();
    expect(screen.getByRole('row', { name: /Paragraph evaluation/ })).toBeTruthy();
    expect(screen.getByRole('row', { name: /Thesis restatement feedback/ })).toBeTruthy();
    expect(screen.getByRole('row', { name: /Summary feedback/ })).toBeTruthy();
    expect(screen.getByRole('row', { name: /Conclusion final comment/ })).toBeTruthy();

    const identify = screen.getByLabelText('Identify Paragraphs') as HTMLInputElement;
    const thesis = screen.getByLabelText('Thesis statement feedback') as HTMLInputElement;
    const summarize = screen.getByLabelText('Summarize main idea') as HTMLInputElement;
    const paragraph = screen.getByLabelText('Paragraph evaluation') as HTMLInputElement;
    const restatement = screen.getByLabelText('Thesis restatement feedback') as HTMLInputElement;
    const summary = screen.getByLabelText('Summary feedback') as HTMLInputElement;
    const conclusion = screen.getByLabelText('Conclusion final comment') as HTMLInputElement;

    expect(identify.checked).toBe(true);
    expect(identify.disabled).toBe(true);
    expect(thesis.checked).toBe(true);
    expect(summarize.checked).toBe(true);
    expect(paragraph.checked).toBe(true);
    expect(restatement.checked).toBe(true);
    expect(summary.checked).toBe(true);
    expect(conclusion.checked).toBe(true);
  });

  it('keeps prerequisite rows selected when dependent rows are turned on', () => {
    render(<EssayFeedbackManager />);

    const thesis = screen.getByLabelText('Thesis statement feedback') as HTMLInputElement;
    const summarize = screen.getByLabelText('Summarize main idea') as HTMLInputElement;
    const paragraph = screen.getByLabelText('Paragraph evaluation') as HTMLInputElement;
    const restatement = screen.getByLabelText('Thesis restatement feedback') as HTMLInputElement;

    fireEvent.click(paragraph);
    expect(paragraph.checked).toBe(false);
    expect(summarize.disabled).toBe(false);

    fireEvent.click(summarize);
    expect(summarize.checked).toBe(false);

    fireEvent.click(paragraph);
    expect(paragraph.checked).toBe(true);
    expect(summarize.checked).toBe(true);
    expect(summarize.disabled).toBe(true);

    expect(thesis.disabled).toBe(true);
    expect(thesis.checked).toBe(true);

    fireEvent.click(restatement);
    expect(restatement.checked).toBe(false);
    expect(thesis.disabled).toBe(false);

    fireEvent.click(thesis);
    expect(thesis.checked).toBe(false);

    fireEvent.click(paragraph);
    expect(paragraph.checked).toBe(false);
    expect(summarize.disabled).toBe(false);

    fireEvent.click(summarize);
    expect(summarize.checked).toBe(false);

    fireEvent.click(restatement);
    expect(restatement.checked).toBe(true);
    expect(thesis.checked).toBe(true);
  });

  it('allows optional conclusion rows to be deselected', () => {
    render(<EssayFeedbackManager />);

    const summary = screen.getByLabelText('Summary feedback') as HTMLInputElement;
    const conclusion = screen.getByLabelText('Conclusion final comment') as HTMLInputElement;

    fireEvent.click(summary);
    fireEvent.click(conclusion);

    expect(summary.checked).toBe(false);
    expect(conclusion.checked).toBe(false);
  });
});
