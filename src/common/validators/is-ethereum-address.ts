import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { isAddress } from 'viem';

export function IsEthAddress(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isEthereumAddressArray',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(address: any) {
          return typeof address === 'string' && isAddress(address);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid Ethereum checksumed address`;
        },
      },
    });
  };
}
