import React, { useEffect, useState } from "react";
import "./App.css";
import "bootstrap/dist/css/bootstrap.min.css";

import _ from "lodash";

const gameWidth = 10;
const gameHeight = 20;

const dropTime = 500; //ms

const startPos = {
  x: Math.floor(gameWidth / 2),
  y: 0,
};

type Mino = {
  type: MinoType;
  rotationAreaWidth: number;
  rotations: number[][][];
};

enum GameBlockState {
  clean,
  filled,
  blocked,
}

enum MoveMinoResult {
  failed,
  success,
  blocked,
}

enum ValidationResult {
  failed,
  success,
  blocked,
}

enum RotateMinoResult {
  failed,
  success,
  blocked,
  wall_kicked,
  floor_kicked,
}

enum RotationMinoMode {
  cw, // clockwise
  ccw, // counter clockwise
  half, // 180 degree
}

enum MoveMinoMode {
  left,
  right,
  up,
  down,
  leftmost,
  rightmost,
  downmost,
}

enum MinoType {
  I,
  J,
  L,
  O,
  S,
  T,
  Z,
}

class GameBoard {
  private gameWidth: number;
  private gameHeight: number;
  private fixedGrid: number[][];
  private currentMinoState: MinoState;

  constructor(w: number, h: number) {
    this.gameWidth = w;
    this.gameHeight = h;
    this.fixedGrid = makeGameGrid(w, h);

    this.currentMinoState = new MinoState(0, 0);
  }

  private validateState(): ValidationResult {
    let minoState = this.currentMinoState;
    let mino = this.currentMinoState.mino;
    if (!mino) return ValidationResult.failed;

    let minoGrid = mino.rotations[this.currentMinoState.rotation];
    for (let y = 0; y < mino.rotationAreaWidth; y++) {
      for (let x = 0; x < mino.rotationAreaWidth; x++) {
        let board_x = minoState.position.x + x;
        let board_y = minoState.position.y + y;

        if (
          minoGrid[y][x] === 1 &&
          (board_x < 0 ||
            board_x >= this.gameWidth ||
            board_y < 0 ||
            board_y >= this.gameHeight ||
            this.fixedGrid[board_y][board_x] !== GameBlockState.clean)
        ) {
          return ValidationResult.blocked;
        }
      }
    }
    return ValidationResult.success;
  }

  rotateMino(mode?: RotationMinoMode): RotateMinoResult {
    let mino = this.currentMinoState.mino;
    if (typeof mino === "undefined") return RotateMinoResult.failed;

    let minoStateBackup = _.cloneDeep(this.currentMinoState);

    this.currentMinoState.rotate(mode);

    let valiRes = this.validateState();
    if (valiRes === ValidationResult.success) {
      return RotateMinoResult.success;
    } else if (valiRes === ValidationResult.blocked) {
      let searchDepth = 1;

      if (mino.type === MinoType.O) searchDepth = 0;
      else if (mino.type === MinoType.I) searchDepth = 2;

      let moveList = [
        MoveMinoMode.up,
        MoveMinoMode.down,
        MoveMinoMode.left,
        MoveMinoMode.right,
      ];
      let rotatedMinoState = _.cloneDeep(this.currentMinoState);

      for (let i = 0; i < moveList.length; i++) {
        this.currentMinoState = _.cloneDeep(rotatedMinoState);
        for (let j = 0; j < searchDepth; j++) {
          this.currentMinoState.move(moveList[i]);
          if (this.validateState() === ValidationResult.success) {
            if (moveList[i] === MoveMinoMode.up)
              return RotateMinoResult.floor_kicked;
            else return RotateMinoResult.wall_kicked;
          }
        }
      }

      this.currentMinoState = minoStateBackup;
      return RotateMinoResult.blocked;
    } else {
      this.currentMinoState = minoStateBackup;
      return RotateMinoResult.failed;
    }
  }

  moveMino(mode: MoveMinoMode): MoveMinoResult {
    let backup = _.cloneDeep(this.currentMinoState);

    if (
      mode in
      [
        MoveMinoMode.down,
        MoveMinoMode.up,
        MoveMinoMode.left,
        MoveMinoMode.right,
      ]
    ) {
      this.currentMinoState.move(mode);

      if (this.validateState() === ValidationResult.success) {
        return MoveMinoResult.success;
      } else {
        this.currentMinoState = backup;
        return MoveMinoResult.blocked;
      }
    } else if (MoveMinoMode.downmost) {
      for (let i = 0; i < this.gameHeight; i++) {
        this.moveMino(MoveMinoMode.down);
        if (this.validateState() !== ValidationResult.success) {
          this.moveMino(MoveMinoMode.up);
          return MoveMinoResult.success;
        }
      }
    }

    return MoveMinoResult.failed;
  }

  setMino(
    mino?: Mino,
    minoDetail?: {
      x?: number;
      y?: number;
      rotation?: number;
    }
  ): void {
    this.currentMinoState.set(mino, minoDetail);
  }

  getMinoState() {
    return _.cloneDeep(this.currentMinoState);
  }

  get gameSize(): { x: number; y: number } {
    return {
      x: this.gameWidth,
      y: this.gameHeight,
    };
  }

  get currentGameGrid(): number[][] {
    let copiedGrid = _.cloneDeep(this.fixedGrid);
    let minoState = this.currentMinoState;

    if (!minoState.mino) return copiedGrid;

    let minoGrid = minoState.mino.rotations[minoState.rotation];
    for (let y = 0; y < minoState.mino.rotationAreaWidth; y++) {
      for (let x = 0; x < minoState.mino.rotationAreaWidth; x++) {
        let board_x = minoState.position.x + x;
        let board_y = minoState.position.y + y;
        if (
          minoGrid[y][x] === 1 &&
          board_x >= 0 &&
          board_x < this.gameWidth &&
          board_y >= 0 &&
          board_y < this.gameHeight
        ) {
          copiedGrid[board_y][board_x] = GameBlockState.filled;
        }
      }
    }

    return copiedGrid;
  }

  solidate(setMinoParams?: Parameters<typeof this.setMino>) {
    let minoState = this.currentMinoState;
    let mino = this.currentMinoState.mino;

    if (!mino) return;

    for (let y = 0; y < mino.rotationAreaWidth; y++) {
      for (let x = 0; x < mino.rotationAreaWidth; x++) {
        let board_x = minoState.position.x + x;
        let board_y = minoState.position.y + y;
        if (
          mino.rotations[minoState.rotation][y][x] === 1 &&
          board_x >= 0 &&
          board_x < this.gameWidth &&
          board_y >= 0 &&
          board_y < this.gameHeight
        ) {
          this.fixedGrid[board_y][board_x] = GameBlockState.blocked;
        }
      }
    }

    if (setMinoParams) {
      this.setMino(...setMinoParams);
    } else {
      this.setMino();
    }
  }

  hardDrop(
    doSolidate: boolean,
    solidateParam?: Parameters<typeof this.solidate>[0]
  ) {
    this.moveMino(MoveMinoMode.downmost);

    if (doSolidate) this.solidate(solidateParam);
  }

  softDrop(): MoveMinoResult {
    return this.moveMino(MoveMinoMode.down);
  }

  getFullLines(): number[] {
    let lines: number[] = [];

    for (let y = 0; y < this.fixedGrid.length; y++) {
      let isFull = true;
      for (let x = 0; x < this.fixedGrid[y].length; x++) {
        if (this.fixedGrid[y][x] !== GameBlockState.blocked) {
          isFull = false;
          break;
        }
      }
      if (isFull) lines.push(y);
    }

    return lines;
  }

  discardLines(deleteLines: number[]) {
    this.fixedGrid = this.fixedGrid.filter((line, no) => {
      return !deleteLines.includes(no);
    });

    let blackLine = new Array<number>(this.gameWidth);
    blackLine.fill(GameBlockState.clean);
    while (this.fixedGrid.length < this.gameHeight) {
      this.fixedGrid.unshift(_.cloneDeep(blackLine));
    }
  }
}

class MinoState {
  position: {
    x: number;
    y: number;
  };
  mino: Mino | undefined;
  rotation: number;

  constructor(px: number, py: number, pMino?: Mino, pRotation?: number) {
    this.position = {
      x: px,
      y: py,
    };
    if (!pMino) {
      this.mino = undefined;
    } else {
      this.mino = pMino;
    }
    if (!pRotation) {
      this.rotation = 0;
    } else {
      this.rotation = pRotation;
    }
  }

  rotate(mode?: RotationMinoMode): void {
    if (!this.mino) return;

    if (typeof mode === "undefined" || mode === RotationMinoMode.cw) {
      this.rotation += 1;
    } else if (mode === RotationMinoMode.ccw) {
      this.rotation -= 1;
    } else if (mode === RotationMinoMode.half) {
      this.rotation += 2;
    }

    if (this.rotation >= this.mino.rotations.length) {
      this.rotation -= this.mino.rotations.length;
    } else if (this.rotation < 0) {
      this.rotation += this.mino.rotations.length;
    }
  }

  move(mode: MoveMinoMode): void {
    switch (mode) {
      case MoveMinoMode.left:
        this.position.x -= 1;
        break;
      case MoveMinoMode.right:
        this.position.x += 1;
        break;
      case MoveMinoMode.down:
        this.position.y += 1;
        break;
      case MoveMinoMode.up:
        this.position.y -= 1;
        break;
    }
  }

  set(
    mino?: Mino,
    detail?: {
      x?: number;
      y?: number;
      rotation?: number;
    }
  ): void {
    this.mino = mino;

    // 검증하는 요소 나중에 추가
    if (detail) {
      if (detail.rotation) {
        this.rotation = detail.rotation;
      } else {
        this.rotation = 0;
      }

      if (detail.x) {
        this.position.x = detail.x;
      } else {
        this.position.x = 0;
      }

      if (detail.y) {
        this.position.y = detail.y;
      } else {
        this.position.y = 0;
      }
    }
  }
}

function App() {
  let [gameGrid, setGameGrid] = useState<number[][]>(
    makeGameGrid(gameWidth, gameHeight)
  );

  let gameBoard = new GameBoard(gameWidth, gameHeight);
  gameBoard.setMino(getRandomMino(), startPos);

  let dropIntervalFun = () => {
    if (gameBoard.softDrop() === MoveMinoResult.blocked) {
      gameBoard.solidate([getRandomMino(), startPos]);
      gameBoard.discardLines(gameBoard.getFullLines());
    }
    setGameGrid(gameBoard.currentGameGrid);
  };

  let dropInterval: NodeJS.Timer;

  

  useEffect(() => {
    setGameGrid(gameBoard.currentGameGrid);

    dropInterval = setInterval(dropIntervalFun, dropTime);

    window.addEventListener(
      "keydown",
      (e) => {
        if (e.defaultPrevented) {
          return; // Do nothing if the event was already processed
        }

        switch (e.key) {
          case "Down":
          case "ArrowDown":
            if (gameBoard.softDrop() === MoveMinoResult.blocked) {
              gameBoard.solidate([getRandomMino(), startPos]);
            }
            clearInterval(dropInterval);
            dropInterval = setInterval(dropIntervalFun, dropTime);
            break;
          case "Up":
          case "ArrowUp":
            gameBoard.rotateMino();
            break;
          case "Left":
          case "ArrowLeft":
            gameBoard.moveMino(MoveMinoMode.left);
            break;
          case "Right":
          case "ArrowRight":
            gameBoard.moveMino(MoveMinoMode.right);
            break;
          case "Spacebar":
          case " ":
            gameBoard.hardDrop(true, [getRandomMino(), startPos]);
            clearInterval(dropInterval);
            dropInterval = setInterval(dropIntervalFun, dropTime);
            break;

          case "x":
          case "X":
            gameBoard.rotateMino(RotationMinoMode.cw);
            break;
            
          case "z":
          case "Z":
            gameBoard.rotateMino(RotationMinoMode.ccw);
            break;
          default:
            return;
        }

        gameBoard.discardLines(gameBoard.getFullLines());

        setGameGrid(gameBoard.currentGameGrid);

        e.preventDefault();
      },
      true
    );

    return () => {
      clearInterval(dropInterval);
    };
  }, []);

  let [targetPos, setTargetPos] = useState({ x: 0, y: 0, blockState: 0 });

  return (
    <div>
      <div className="container mx-auto m-3">
        <div className="d-flex flex-column gap-1">
          {gameGrid.map((line, i_y) => {
            return (
              <div className="d-flex gap-1 mx-auto" key={i_y}>
                {line.map((elem, i_x) => {
                  return (
                    <div
                      key={i_x}
                      style={{
                        width: "30px",
                        height: "30px",
                        border: "solid 1px lightgray",
                        borderRadius: "3px",
                        backgroundColor: `${(() => {
                          switch (elem) {
                            case GameBlockState.clean:
                              return "white";
                            case GameBlockState.blocked:
                              return "black";
                            case GameBlockState.filled:
                              return "gray";
                            default:
                              return "white";
                          }
                        })()}`,
                      }}
                    ></div>
                  );
                })}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

export default App;

function makeGameGrid(w: number, h: number) {
  let oneHorizontalLine = new Array<number>(w);
  oneHorizontalLine.fill(GameBlockState.clean);
  let gameGrid: GameBlockState[][] = [];
  for (let i = 0; i < gameHeight; i++) {
    gameGrid.push([...oneHorizontalLine]);
  }
  return gameGrid;
}

function getModifiedGridState(
  gameGrid: number[][],
  x: number,
  y: number,
  state: GameBlockState
) {
  let copied = _.cloneDeep(gameGrid);
  copied[y][x] = state;
  return copied;
}

function getRandomMino(): Mino {
  return minos[Math.floor(Math.random() * minos.length)];
}

let minos: Mino[] = [
  {
    type: MinoType.I,
    rotationAreaWidth: 4,
    rotations: [
      [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      [
        [0, 0, 1, 0],
        [0, 0, 1, 0],
        [0, 0, 1, 0],
        [0, 0, 1, 0],
      ],
      [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
      ],
      [
        [0, 1, 0, 0],
        [0, 1, 0, 0],
        [0, 1, 0, 0],
        [0, 1, 0, 0],
      ],
    ],
  },
  {
    type: MinoType.J,
    rotationAreaWidth: 3,
    rotations: [
      [
        [1, 0, 0],
        [1, 1, 1],
        [0, 0, 0],
      ],
      [
        [0, 1, 1],
        [0, 1, 0],
        [0, 1, 0],
      ],
      [
        [0, 0, 0],
        [1, 1, 1],
        [0, 0, 1],
      ],
      [
        [0, 1, 0],
        [0, 1, 0],
        [1, 1, 0],
      ],
    ],
  },
  {
    type: MinoType.L,
    rotationAreaWidth: 3,
    rotations: [
      [
        [0, 0, 1],
        [1, 1, 1],
        [0, 0, 0],
      ],
      [
        [0, 1, 0],
        [0, 1, 0],
        [0, 1, 1],
      ],
      [
        [0, 0, 0],
        [1, 1, 1],
        [1, 0, 0],
      ],
      [
        [1, 1, 0],
        [0, 1, 0],
        [0, 1, 0],
      ],
    ],
  },
  {
    type: MinoType.O,
    rotationAreaWidth: 2,
    rotations: [
      [
        [1, 1],
        [1, 1],
      ],
      [
        [1, 1],
        [1, 1],
      ],
      [
        [1, 1],
        [1, 1],
      ],
      [
        [1, 1],
        [1, 1],
      ],
    ],
  },
  {
    type: MinoType.S,
    rotationAreaWidth: 3,
    rotations: [
      [
        [0, 1, 1],
        [1, 1, 0],
        [0, 0, 0],
      ],
      [
        [0, 1, 0],
        [0, 1, 1],
        [0, 0, 1],
      ],
      [
        [0, 0, 0],
        [0, 1, 1],
        [1, 1, 0],
      ],
      [
        [1, 0, 0],
        [1, 1, 0],
        [0, 1, 0],
      ],
    ],
  },
  {
    type: MinoType.T,
    rotationAreaWidth: 3,
    rotations: [
      [
        [0, 1, 0],
        [1, 1, 1],
        [0, 0, 0],
      ],
      [
        [0, 1, 0],
        [0, 1, 1],
        [0, 1, 0],
      ],
      [
        [0, 0, 0],
        [1, 1, 1],
        [0, 1, 0],
      ],
      [
        [0, 1, 0],
        [1, 1, 0],
        [0, 1, 0],
      ],
    ],
  },
  {
    type: MinoType.Z,
    rotationAreaWidth: 3,
    rotations: [
      [
        [1, 1, 0],
        [0, 1, 1],
        [0, 0, 0],
      ],
      [
        [0, 0, 1],
        [0, 1, 1],
        [0, 1, 0],
      ],
      [
        [0, 0, 0],
        [1, 1, 0],
        [0, 1, 1],
      ],
      [
        [0, 1, 0],
        [1, 1, 0],
        [1, 0, 0],
      ],
    ],
  },
];
