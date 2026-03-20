import ora, { type Ora } from 'ora';

export class Spinner {
  private spinner: Ora;

  constructor() {
    this.spinner = ora({ color: 'cyan' });
  }

  start(text: string): void {
    this.spinner.start(text);
  }

  update(text: string): void {
    this.spinner.text = text;
  }

  succeed(text: string): void {
    this.spinner.succeed(text);
  }

  fail(text: string): void {
    this.spinner.fail(text);
  }

  stop(): void {
    this.spinner.stop();
  }
}
