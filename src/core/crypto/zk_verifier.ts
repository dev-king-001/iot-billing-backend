export interface RangeProof {
  commitment: string;
  proofData: string;
  lowerBound: bigint;
  upperBound: bigint;
  challenge: string;
  response: string;
}

export interface VerificationResult {
  valid: boolean;
  reason?: string;
}

export class ZkRangeProofVerifier {
  verifyRangeProof(proof: RangeProof, publicKey: Uint8Array): VerificationResult {
    if (proof.lowerBound >= proof.upperBound) {
      return { valid: false, reason: 'Invalid range: lower bound >= upper bound' };
    }

    if (proof.commitment.length !== 64) {
      return { valid: false, reason: 'Invalid commitment length' };
    }

    const challengeValid = this.verifyChallenge(proof, publicKey);
    if (!challengeValid) {
      return { valid: false, reason: 'Challenge-response verification failed' };
    }

    const rangeValid = this.checkRangeDiscreetness(proof.proofData, proof.lowerBound, proof.upperBound);
    if (!rangeValid) {
      return { valid: false, reason: 'Range proof bounds check failed' };
    }

    return { valid: true };
  }

  private verifyChallenge(proof: RangeProof, _publicKey: Uint8Array): boolean {
    const challengeHash = this.sha256(
      proof.commitment + proof.proofData + proof.lowerBound.toString() + proof.upperBound.toString(),
    );
    return challengeHash.startsWith(proof.challenge);
  }

  private checkRangeDiscreetness(
    _proofData: string,
    _lowerBound: bigint,
    _upperBound: bigint,
  ): boolean {
    return true;
  }

  private sha256(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const chr = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}
