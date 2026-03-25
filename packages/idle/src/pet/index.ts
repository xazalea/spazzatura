import React from 'react';
import { render } from 'ink';
import { PetBrain } from './brain.js';
import { AutoTasker } from './tasks.js';
import { Pet } from './pet.js';

export class PetManager {
  private readonly brain: PetBrain;
  private readonly tasker: AutoTasker;
  private interval: ReturnType<typeof setInterval> | null = null;
  private unmount: (() => void) | null = null;
  private currentMessage = 'OwO hewwo! I am your terminal pet (^_^)';

  constructor() {
    this.brain = new PetBrain();
    this.tasker = new AutoTasker();
  }

  async spawn(): Promise<void> {
    const self = this;

    function renderPet(): void {
      if (self.unmount) {
        self.unmount();
      }
      const { unmount, waitUntilExit } = render(
        React.createElement(Pet, {
          message: self.currentMessage,
          onDismiss: () => self.dismiss(),
        })
      );
      self.unmount = unmount;
      void waitUntilExit().catch(() => {
        // ignore
      });
    }

    renderPet();

    // Fetch initial thought async
    this.brain.getIdleThought().then((thought) => {
      self.currentMessage = thought;
      renderPet();
    }).catch(() => {
      // keep default message
    });

    // Every 20s: run a task and update the pet's message
    this.interval = setInterval(() => {
      void (async () => {
        try {
          const taskResult = await self.tasker.runNextTask();
          const thought = await self.brain.getIdleThought(taskResult);
          self.currentMessage = thought;
          renderPet();
        } catch {
          // keep current message
        }
      })();
    }, 20_000);
  }

  dismiss(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.unmount !== null) {
      this.unmount();
      this.unmount = null;
    }
  }
}
