"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";

const SHAPES = [
  [[1, 1, 1, 1]], // I
  [[1, 1], [1, 1]], // O
  [[1, 1, 1], [0, 1, 0]], // T
  [[1, 1, 1], [1, 0, 0]], // L
  [[1, 1, 1], [0, 0, 1]], // J
  [[1, 1, 0], [0, 1, 1]], // S
  [[0, 1, 1], [1, 1, 0]], // Z
];

const COLORS = [
  "#00f0f0", // cyan
  "#f0f000", // yellow
  "#a000f0", // purple
  "#f0a000", // orange
  "#0000f0", // blue
  "#00f000", // green
  "#f00000", // red
];

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;

type Position = { x: number; y: number };

const TetrisGame = () => {
  const [board, setBoard] = useState(() =>
    Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null))
  );
  const [currentPiece, setCurrentPiece] = useState<number[][]>([]);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [color, setColor] = useState("");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  // Add refs for synchronous access
  const positionRef = useRef(position);
  const currentPieceRef = useRef(currentPiece);
  const boardRef = useRef(board);
  const colorRef = useRef(color);
  const isLockedRef = useRef(isLocked);

  // Calculate fall speed based on score
  const getFallSpeed = useCallback(() => {
    // Start at 1000ms and decrease by 100ms for every 2000 points
    // Minimum speed of 100ms
    const baseSpeed = 1000;
    const speedDecrease = Math.floor(score / 2000) * 100;
    return Math.max(baseSpeed - speedDecrease, 100);
  }, [score]);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    currentPieceRef.current = currentPiece;
  }, [currentPiece]);

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  useEffect(() => {
    colorRef.current = color;
  }, [color]);

  useEffect(() => {
    isLockedRef.current = isLocked;
  }, [isLocked]);

  // Load high score on mount
  useEffect(() => {
    const savedHighScore = localStorage.getItem('tetrisHighScore');
    if (savedHighScore) {
      setHighScore(parseInt(savedHighScore));
    }
  }, []);

  // Update high score when game ends
  useEffect(() => {
    if (gameOver && score > highScore) {
      setHighScore(score);
      localStorage.setItem('tetrisHighScore', score.toString());
    }
  }, [gameOver, score, highScore]);

  const createPiece = useCallback(() => {
    const index = Math.floor(Math.random() * SHAPES.length);
    const piece = SHAPES[index];
    setCurrentPiece(piece);
    setColor(COLORS[index]);
    setPosition({ x: Math.floor(BOARD_WIDTH / 2 - piece[0].length / 2), y: 0 });
    setIsLocked(false);
  }, []);

  const checkCollision = useCallback((newPos: Position, piece: number[][]) => {
    for (let y = 0; y < piece.length; y++) {
      for (let x = 0; x < piece[y].length; x++) {
        if (piece[y][x]) {
          const newX = newPos.x + x;
          const newY = newPos.y + y;
          if (
            newX < 0 ||
            newX >= BOARD_WIDTH ||
            newY >= BOARD_HEIGHT ||
            (newY >= 0 && boardRef.current[newY][newX])
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }, []);

  const checkLines = useCallback((board: (string | null)[][]) => {
    const newBoard = board.filter((row) => row.some((cell) => !cell));
    const linesCleared = BOARD_HEIGHT - newBoard.length;

    if (linesCleared > 0) {
      const newScore = score + linesCleared * 100;
      setScore(newScore);
      return [
        ...Array(linesCleared)
          .fill(null)
          .map(() => Array(BOARD_WIDTH).fill(null)),
        ...newBoard,
      ];
    }
    return board;
  }, [score]);

  const mergePiece = useCallback(() => {
    if (isLockedRef.current) return;
    
    const newBoard = boardRef.current.map((row) => [...row]);
    let gameOver = false;

    // Check for game over before merging
    if (positionRef.current.y <= 0 && checkCollision(positionRef.current, currentPieceRef.current)) {
      setGameOver(true);
      return;
    }

    for (let y = 0; y < currentPieceRef.current.length; y++) {
      for (let x = 0; x < currentPieceRef.current[y].length; x++) {
        if (currentPieceRef.current[y][x]) {
          const newY = positionRef.current.y + y;
          if (newY < 0) {
            gameOver = true;
            break;
          }
          newBoard[newY][positionRef.current.x + x] = colorRef.current;
        }
      }
    }

    if (gameOver) {
      setGameOver(true);
      return;
    }

    const clearedBoard = checkLines(newBoard);
    setBoard(clearedBoard);
    setIsLocked(true);
    createPiece();
  }, [checkLines, createPiece]);

  const moveDown = useCallback(() => {
    if (gameOver || isLockedRef.current) return;

    const newPos = { x: positionRef.current.x, y: positionRef.current.y + 1 };
    if (checkCollision(newPos, currentPieceRef.current)) {
      mergePiece();
      return;
    }
    setPosition(newPos);
  }, [gameOver, checkCollision, mergePiece]);

  const rotatePiece = useCallback(() => {
    if (isLockedRef.current) return;
    
    const rotated = currentPieceRef.current[0].map((_, i) =>
      currentPieceRef.current.map((row) => row[row.length - 1 - i])
    );

    // Wall kick checks
    const testPositions = [
      { x: 0, y: 0 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: -2, y: 0 },
      { x: 2, y: 0 },
    ];

    for (const test of testPositions) {
      const testPosition = {
        x: positionRef.current.x + test.x,
        y: positionRef.current.y + test.y,
      };

      if (!checkCollision(testPosition, rotated)) {
        setPosition(testPosition);
        setCurrentPiece(rotated);
        return;
      }
    }
  }, [checkCollision]);

  const hardDrop = useCallback(() => {
    if (isLockedRef.current) return;
    
    let newY = positionRef.current.y;
    // Find the lowest valid position
    while (newY < BOARD_HEIGHT) {
      if (checkCollision({ x: positionRef.current.x, y: newY + 1 }, currentPieceRef.current)) {
        break;
      }
      newY++;
    }
    
    // Update position and immediately merge
    setPosition({ x: positionRef.current.x, y: newY });
    setTimeout(() => mergePiece(), 0); // Ensure position is updated before merging
  }, [checkCollision, mergePiece]);

  const resetGame = useCallback(() => {
    setBoard(Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null)));
    setScore(0);
    setGameOver(false);
    setIsLocked(false);
    createPiece();
  }, [createPiece]);

  const handleKeyPress = useCallback(
    (e: KeyboardEvent) => {
      // Handle restart (Ctrl + R)
      if (e.key.toLowerCase() === 'r' && e.ctrlKey) {
        e.preventDefault(); // Prevent browser refresh
        resetGame();
        return;
      }

      if (gameOver || isLockedRef.current) return;

      switch (e.key) {
        case "ArrowLeft": {
          const newPos = { x: positionRef.current.x - 1, y: positionRef.current.y };
          if (!checkCollision(newPos, currentPieceRef.current)) {
            setPosition(newPos);
          }
          break;
        }
        case "ArrowRight": {
          const newPos = { x: positionRef.current.x + 1, y: positionRef.current.y };
          if (!checkCollision(newPos, currentPieceRef.current)) {
            setPosition(newPos);
          }
          break;
        }
        case "ArrowDown":
          moveDown();
          break;
        case "ArrowUp":
          rotatePiece();
          break;
        case " ":
          e.preventDefault();
          hardDrop();
          break;
      }
    },
    [gameOver, checkCollision, moveDown, rotatePiece, hardDrop, resetGame]
  );

  useEffect(() => {
    createPiece();
  }, [createPiece]);

  useEffect(() => {
    if (gameOver) return;
    
    const interval = setInterval(moveDown, getFallSpeed());
    return () => clearInterval(interval);
  }, [moveDown, gameOver, getFallSpeed]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [handleKeyPress]);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="mb-4 space-y-2 text-center">
        <div className="text-2xl font-bold text-white">Score: {score}</div>
        <div className="text-xl font-bold text-yellow-500">High Score: {highScore}</div>
        <div className="text-sm text-gray-400">
          Speed: {Math.round(1000 / getFallSpeed())}x
        </div>
      </div>
      <div className="bg-gray-800 p-2 rounded-lg shadow-lg">
        <div
          className="grid gap-px bg-gray-700"
          style={{
            gridTemplateRows: `repeat(${BOARD_HEIGHT}, minmax(0, 1fr))`,
            gridTemplateColumns: `repeat(${BOARD_WIDTH}, minmax(0, 1fr))`,
            width: `${BOARD_WIDTH * 24}px`,
            height: `${BOARD_HEIGHT * 24}px`,
          }}
        >
          {board.map((row, y) =>
            row.map((cellColor, x) => {
              const isCurrentPiece =
                y >= position.y &&
                y < position.y + currentPiece.length &&
                x >= position.x &&
                x < position.x + currentPiece[0]?.length &&
                currentPiece[y - position.y]?.[x - position.x];

              return (
                <div
                  key={`${y}-${x}`}
                  className="transition-colors duration-100"
                  style={{
                    backgroundColor: isCurrentPiece ? color : cellColor || "#1F2937",
                  }}
                />
              );
            })
          )}
        </div>
      </div>
      {gameOver && (
        <div className="mt-4 text-xl font-bold text-red-500">
          Game Over! Press Ctrl+R to play again.
        </div>
      )}
      <div className="mt-4 text-white text-center">
        <p>Controls:</p>
        <p>← → : Move</p>
        <p>↑ : Rotate</p>
        <p>↓ : Soft Drop</p>
        <p>Space : Hard Drop</p>
        <p>Ctrl+R : Restart</p>
      </div>
    </div>
  );
};

export default TetrisGame;