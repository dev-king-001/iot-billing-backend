export class SafeMath {
  static readonly SOROBAN_DECIMALS = 7;
  static readonly MAX_SOROBAN_VALUE = 2n ** 63n - 1n;
  static readonly MIN_SOROBAN_VALUE = -(2n ** 63n);

  static toSorobanPrecision(rawValue: bigint, sourceDecimals: number): bigint {
    if (sourceDecimals === this.SOROBAN_DECIMALS) return rawValue;
    if (sourceDecimals > this.SOROBAN_DECIMALS) {
      return rawValue / 10n ** BigInt(sourceDecimals - this.SOROBAN_DECIMALS);
    }
    return rawValue * 10n ** BigInt(this.SOROBAN_DECIMALS - sourceDecimals);
  }

  static multiplyWithPrecision(a: bigint, b: bigint, precisionDecimals: number): bigint {
    const product = a * b;
    const divisor = 10n ** BigInt(precisionDecimals);
    return product / divisor;
  }

  static checkOverflow(value: bigint): boolean {
    if (value > this.MAX_SOROBAN_VALUE || value < this.MIN_SOROBAN_VALUE) {
      return true;
    }
    return false;
  }

  static safeAdd(a: bigint, b: bigint): bigint {
    const result = a + b;
    if (this.checkOverflow(result)) {
      throw new RangeError(`Integer overflow in addition: ${a} + ${b}`);
    }
    return result;
  }

  static safeMultiply(a: bigint, b: bigint): bigint {
    const result = a * b;
    if (this.checkOverflow(result)) {
      throw new RangeError(`Integer overflow in multiplication: ${a} * ${b}`);
    }
    return result;
  }
}
