export function createBlank() {
  // Create and return a new Blank instance
  return {
    name: 'blank',
    initialize() {
      console.log('Initializing blank');
    },
    update(deltaTime: number) {
      // Update logic for blank
    },
    destroy() {
      console.log('Destroying blank');
    }
  };
}

export class BlankManager {
  private instances: any[] = [];

  addInstance(instance: any) {
    this.instances.push(instance);
  }

  removeInstance(instance: any) {
    const index = this.instances.indexOf(instance);
    if (index > -1) {
      this.instances.splice(index, 1);
    }
  }

  updateAll(deltaTime: number) {
    this.instances.forEach(instance => {
      if (instance.update) {
        instance.update(deltaTime);
      }
    });
  }

  clear() {
    this.instances.forEach(instance => {
      if (instance.destroy) {
        instance.destroy();
      }
    });
    this.instances = [];
  }
}

export const blankUtils = {
  isValid(item: any): boolean {
    return item != null;
  },

  format(value: any): string {
    return String(value);
  }
};
