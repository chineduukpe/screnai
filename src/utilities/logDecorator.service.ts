export function logErrorDecorator(bubble: Boolean = true) {

  return (target: any, propertyKey: string, propertyDescriptor: PropertyDescriptor) => {
    //get original method
    const originalMethod = propertyDescriptor.value;

    //redefine descriptor value within own function block
    propertyDescriptor.value = async function(...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        const logger = this.logger;
        logger.error(error.message, error.stack);
        // rethrow error, so it can bubble up
        if (bubble) {
          throw error;
        }
      }
    };
  };
}
