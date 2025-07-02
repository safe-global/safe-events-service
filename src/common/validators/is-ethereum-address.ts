import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { isAddress } from 'viem';

export function IsEthereumAddressArray(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isEthereumAddressArray',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(addresses: any) {
          return (
            Array.isArray(addresses) &&
            addresses.every(
              (addr) => typeof addr === 'string' && isAddress(addr),
            )
          );
        },
        defaultMessage(args: ValidationArguments) {
          return `Each element in ${args.property} must be a valid Ethereum address`;
        },
      },
    });
  };
}
