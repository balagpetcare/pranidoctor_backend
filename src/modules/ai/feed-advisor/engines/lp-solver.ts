import type { LpProblem, LpSolution, LpConstraint, LpVariable } from './formulation-types.js';

/**
 * Simple Simplex-based LP solver for feed formulation.
 * This is a basic implementation suitable for small-scale feed formulation problems.
 * For production use with larger problems, consider integrating a full LP library.
 */
export class SimplexSolver {
  private maxIterations = 1000;
  private epsilon = 1e-9;

  solve(problem: LpProblem): LpSolution {
    try {
      const standardForm = this.convertToStandardForm(problem);
      const result = this.runSimplex(standardForm);
      return this.interpretResult(result, problem);
    } catch (error) {
      return {
        status: 'error',
        objectiveValue: 0,
        variables: new Map(),
      };
    }
  }

  private convertToStandardForm(problem: LpProblem): StandardFormProblem {
    const numVars = problem.variables.length;
    const numConstraints = problem.constraints.length;

    const c: number[] = new Array(numVars).fill(0);
    for (let i = 0; i < numVars; i++) {
      c[i] = problem.objective === 'minimize'
        ? problem.variables[i].coefficient
        : -problem.variables[i].coefficient;
    }

    const A: number[][] = [];
    const b: number[] = [];
    const slackVarsNeeded: number[] = [];
    const artificialVarsNeeded: number[] = [];

    for (let i = 0; i < numConstraints; i++) {
      const constraint = problem.constraints[i];
      const row = new Array(numVars).fill(0);

      for (const v of constraint.variables) {
        const idx = problem.variables.findIndex((pv) => pv.name === v.name);
        if (idx >= 0) {
          row[idx] = v.coefficient;
        }
      }

      if (constraint.relation === 'le') {
        slackVarsNeeded.push(i);
      } else if (constraint.relation === 'ge') {
        slackVarsNeeded.push(-i - 1);
        artificialVarsNeeded.push(i);
      } else {
        artificialVarsNeeded.push(i);
      }

      A.push(row);
      b.push(constraint.rhs);
    }

    const totalSlack = slackVarsNeeded.length;
    const totalArtificial = artificialVarsNeeded.length;
    const totalCols = numVars + totalSlack + totalArtificial;

    for (let i = 0; i < numConstraints; i++) {
      while (A[i].length < totalCols) {
        A[i].push(0);
      }
    }

    while (c.length < totalCols) {
      c.push(0);
    }

    let slackIdx = numVars;
    for (const s of slackVarsNeeded) {
      const constraintIdx = s >= 0 ? s : -(s + 1);
      const sign = s >= 0 ? 1 : -1;
      A[constraintIdx][slackIdx] = sign;
      slackIdx++;
    }

    let artIdx = numVars + totalSlack;
    for (const a of artificialVarsNeeded) {
      A[a][artIdx] = 1;
      c[artIdx] = 1e6;
      artIdx++;
    }

    for (let i = 0; i < numVars; i++) {
      const v = problem.variables[i];
      if (v.lowerBound > 0) {
        for (let j = 0; j < numConstraints; j++) {
          b[j] -= A[j][i] * v.lowerBound;
        }
      }
    }

    return {
      c,
      A,
      b,
      numOriginalVars: numVars,
      numSlackVars: totalSlack,
      numArtificialVars: totalArtificial,
      originalProblem: problem,
    };
  }

  private runSimplex(sf: StandardFormProblem): SimplexResult {
    const { A, b, c } = sf;
    const numRows = A.length;
    const numCols = A[0].length;

    const tableau: number[][] = [];
    for (let i = 0; i < numRows; i++) {
      tableau.push([...A[i], b[i]]);
    }
    tableau.push([...c, 0]);

    const basicVars: number[] = [];
    for (let i = 0; i < numRows; i++) {
      const artStart = sf.numOriginalVars + sf.numSlackVars;
      const slackStart = sf.numOriginalVars;

      let foundBasic = -1;
      for (let j = artStart; j < numCols; j++) {
        if (A[i][j] === 1 && this.columnHasOnlyOneOne(A, j, numRows)) {
          foundBasic = j;
          break;
        }
      }
      if (foundBasic < 0) {
        for (let j = slackStart; j < artStart; j++) {
          if (A[i][j] === 1 && this.columnHasOnlyOneOne(A, j, numRows)) {
            foundBasic = j;
            break;
          }
        }
      }
      basicVars.push(foundBasic >= 0 ? foundBasic : i);
    }

    for (let iter = 0; iter < this.maxIterations; iter++) {
      let pivotCol = -1;
      let minC = -this.epsilon;
      for (let j = 0; j < numCols; j++) {
        if (tableau[numRows][j] < minC) {
          minC = tableau[numRows][j];
          pivotCol = j;
        }
      }

      if (pivotCol < 0) {
        const artStart = sf.numOriginalVars + sf.numSlackVars;
        for (let i = 0; i < numRows; i++) {
          if (basicVars[i] >= artStart && tableau[i][numCols] > this.epsilon) {
            return { status: 'infeasible', values: new Map(), objectiveValue: Infinity };
          }
        }
        break;
      }

      let pivotRow = -1;
      let minRatio = Infinity;
      for (let i = 0; i < numRows; i++) {
        if (tableau[i][pivotCol] > this.epsilon) {
          const ratio = tableau[i][numCols] / tableau[i][pivotCol];
          if (ratio >= 0 && ratio < minRatio) {
            minRatio = ratio;
            pivotRow = i;
          }
        }
      }

      if (pivotRow < 0) {
        return { status: 'unbounded', values: new Map(), objectiveValue: -Infinity };
      }

      basicVars[pivotRow] = pivotCol;
      const pivotVal = tableau[pivotRow][pivotCol];
      for (let j = 0; j <= numCols; j++) {
        tableau[pivotRow][j] /= pivotVal;
      }

      for (let i = 0; i <= numRows; i++) {
        if (i !== pivotRow) {
          const factor = tableau[i][pivotCol];
          for (let j = 0; j <= numCols; j++) {
            tableau[i][j] -= factor * tableau[pivotRow][j];
          }
        }
      }
    }

    const values = new Map<number, number>();
    for (let i = 0; i < numRows; i++) {
      values.set(basicVars[i], tableau[i][numCols]);
    }

    const artStart = sf.numOriginalVars + sf.numSlackVars;
    for (let j = artStart; j < numCols; j++) {
      const val = values.get(j);
      if (val && val > this.epsilon) {
        return { status: 'infeasible', values: new Map(), objectiveValue: Infinity };
      }
    }

    const objectiveValue = -tableau[numRows][numCols];

    return { status: 'optimal', values, objectiveValue };
  }

  private columnHasOnlyOneOne(A: number[][], col: number, numRows: number): boolean {
    let countOnes = 0;
    for (let i = 0; i < numRows; i++) {
      if (Math.abs(A[i][col]) > this.epsilon) {
        if (Math.abs(A[i][col] - 1) < this.epsilon) {
          countOnes++;
        } else {
          return false;
        }
      }
    }
    return countOnes === 1;
  }

  private interpretResult(result: SimplexResult, problem: LpProblem): LpSolution {
    if (result.status !== 'optimal') {
      return {
        status: result.status,
        objectiveValue: result.objectiveValue,
        variables: new Map(),
      };
    }

    const variables = new Map<string, number>();
    for (let i = 0; i < problem.variables.length; i++) {
      const v = problem.variables[i];
      let val = result.values.get(i) ?? 0;
      val += v.lowerBound;
      val = Math.max(v.lowerBound, Math.min(v.upperBound, val));
      variables.set(v.name, val);
    }

    let obj = result.objectiveValue;
    if (problem.objective === 'maximize') {
      obj = -obj;
    }

    return {
      status: 'optimal',
      objectiveValue: obj,
      variables,
    };
  }
}

type StandardFormProblem = {
  c: number[];
  A: number[][];
  b: number[];
  numOriginalVars: number;
  numSlackVars: number;
  numArtificialVars: number;
  originalProblem: LpProblem;
};

type SimplexResult = {
  status: 'optimal' | 'infeasible' | 'unbounded' | 'error';
  values: Map<number, number>;
  objectiveValue: number;
};

let solverInstance: SimplexSolver | undefined;

export function getLpSolver(): SimplexSolver {
  if (!solverInstance) {
    solverInstance = new SimplexSolver();
  }
  return solverInstance;
}
