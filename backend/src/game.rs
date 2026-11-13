use std::time::{Duration, Instant};

use shakmaty::{fen::Fen, uci::Uci, Chess, Color, EnPassantMode, Position, Role, Square};

use crate::protocol::{GameId, GameSnapshot, Side};

pub const INITIAL_CLOCK: Duration = Duration::from_secs(5 * 60);

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum MoveError {
    #[error("Não é o seu turno de jogar!")]
    OutOfTurn,
    #[error("A partida já terminou!")]
    Finished,
    #[error("Movimento ilegal na posição atual.")]
    Illegal,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MoveOutcome {
    Played,
    Flagged { winner: Side },
}

#[derive(Debug, Clone)]
pub struct Game {
    position: Chess,
    remaining: [Duration; 2],
    turn_began: Option<Instant>,
    flag_winner: Option<Side>,
}

impl Default for Game {
    fn default() -> Self {
        Self::new()
    }
}

impl Game {
    pub fn new() -> Self {
        Self {
            position: Chess::default(),
            remaining: [INITIAL_CLOCK; 2],
            turn_began: None,
            flag_winner: None,
        }
    }

    pub fn turn(&self) -> Side {
        side_from(self.position.turn())
    }

    pub fn started(&self) -> bool {
        self.turn_began.is_some()
    }

    pub fn is_over(&self) -> bool {
        self.flag_winner.is_some() || self.position.is_game_over()
    }

    pub fn fen(&self) -> String {
        Fen::from_position(self.position.clone(), EnPassantMode::Legal).to_string()
    }

    pub fn tick(&mut self, now: Instant) -> Option<Side> {
        if self.is_over() {
            return None;
        }
        let began = self.turn_began?;
        let mover = self.turn();
        let spent = now.saturating_duration_since(began);

        if spent < self.remaining[mover.index()] {
            return None;
        }
        self.remaining[mover.index()] = Duration::ZERO;
        self.flag_winner = Some(mover.opposite());
        self.flag_winner
    }

    pub fn play(
        &mut self,
        side: Side,
        from: Square,
        to: Square,
        promotion: Option<Role>,
        now: Instant,
    ) -> Result<MoveOutcome, MoveError> {
        if self.is_over() {
            return Err(MoveError::Finished);
        }
        if side != self.turn() {
            return Err(MoveError::OutOfTurn);
        }
        if let Some(winner) = self.tick(now) {
            return Ok(MoveOutcome::Flagged { winner });
        }

        let candidate = [promotion, Some(Role::Queen)]
            .into_iter()
            .find_map(|promotion| {
                Uci::Normal {
                    from,
                    to,
                    promotion,
                }
                .to_move(&self.position)
                .ok()
            })
            .ok_or(MoveError::Illegal)?;

        if let Some(began) = self.turn_began {
            let slot = &mut self.remaining[side.index()];
            *slot = slot.saturating_sub(now.saturating_duration_since(began));
        }
        self.position.play_unchecked(&candidate);
        self.turn_began = Some(now);
        Ok(MoveOutcome::Played)
    }

    pub fn snapshot(&self, id: &GameId) -> GameSnapshot {
        GameSnapshot {
            game_id: id.clone(),
            fen: self.fen(),
            white_time_ms: millis(self.remaining[Side::White.index()]),
            black_time_ms: millis(self.remaining[Side::Black.index()]),
            game_started: self.started(),
            timeout_winner: self.flag_winner,
        }
    }
}

fn side_from(color: Color) -> Side {
    match color {
        Color::White => Side::White,
        Color::Black => Side::Black,
    }
}

fn millis(duration: Duration) -> u64 {
    u64::try_from(duration.as_millis()).unwrap_or(u64::MAX)
}

pub fn parse_square(raw: &str) -> Option<Square> {
    Square::from_ascii(raw.as_bytes()).ok()
}

pub fn parse_promotion(raw: Option<char>) -> Option<Role> {
    raw.and_then(Role::from_char)
        .filter(|role| !matches!(role, Role::Pawn | Role::King))
}

#[cfg(test)]
mod tests {
    use super::*;
    use shakmaty::CastlingMode;

    fn sq(raw: &str) -> Square {
        parse_square(raw).unwrap()
    }

    fn play(
        game: &mut Game,
        side: Side,
        uci: &str,
        now: Instant,
    ) -> Result<MoveOutcome, MoveError> {
        game.play(side, sq(&uci[..2]), sq(&uci[2..4]), None, now)
    }

    fn play_all(game: &mut Game, moves: &[&str], now: Instant) {
        for (index, uci) in moves.iter().enumerate() {
            let side = if index % 2 == 0 {
                Side::White
            } else {
                Side::Black
            };
            play(game, side, uci, now).unwrap();
        }
    }

    #[test]
    fn rejects_moves_out_of_turn() {
        let mut game = Game::new();
        let result = play(&mut game, Side::Black, "e7e5", Instant::now());
        assert_eq!(result, Err(MoveError::OutOfTurn));
    }

    #[test]
    fn rejects_illegal_moves_without_touching_the_position() {
        let mut game = Game::new();
        let before = game.fen();
        assert_eq!(
            play(&mut game, Side::White, "e2e5", Instant::now()),
            Err(MoveError::Illegal)
        );
        assert_eq!(game.fen(), before);
        assert!(!game.started());
    }

    #[test]
    fn clocks_start_only_after_the_first_move() {
        let t0 = Instant::now();
        let mut game = Game::new();
        assert_eq!(game.tick(t0 + Duration::from_secs(3600)), None);

        play(&mut game, Side::White, "e2e4", t0).unwrap();
        play(&mut game, Side::Black, "e7e5", t0 + Duration::from_secs(7)).unwrap();

        let snapshot = game.snapshot(&GameId("g".into()));
        assert_eq!(snapshot.white_time_ms, 300_000);
        assert_eq!(snapshot.black_time_ms, 293_000);
        assert!(snapshot.game_started);
    }

    #[test]
    fn flags_the_side_that_runs_out_of_time() {
        let t0 = Instant::now();
        let mut game = Game::new();
        play(&mut game, Side::White, "e2e4", t0).unwrap();

        assert_eq!(
            game.tick(t0 + INITIAL_CLOCK - Duration::from_millis(1)),
            None
        );
        assert_eq!(game.tick(t0 + INITIAL_CLOCK), Some(Side::White));
        assert!(game.is_over());
        assert_eq!(
            play(&mut game, Side::Black, "e7e5", t0 + INITIAL_CLOCK),
            Err(MoveError::Finished)
        );
    }

    #[test]
    fn a_late_move_loses_on_time_instead_of_being_played() {
        let t0 = Instant::now();
        let mut game = Game::new();
        play(&mut game, Side::White, "e2e4", t0).unwrap();

        let late = t0 + INITIAL_CLOCK + Duration::from_secs(1);
        assert_eq!(
            play(&mut game, Side::Black, "e7e5", late),
            Ok(MoveOutcome::Flagged {
                winner: Side::White
            })
        );
    }

    #[test]
    fn supports_standard_castling_notation() {
        let now = Instant::now();
        let mut game = Game::new();
        play_all(
            &mut game,
            &["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6"],
            now,
        );
        assert_eq!(
            play(&mut game, Side::White, "e1g1", now),
            Ok(MoveOutcome::Played)
        );
        assert!(game
            .fen()
            .starts_with("r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1"));
    }

    #[test]
    fn checkmate_finishes_the_game() {
        let now = Instant::now();
        let mut game = Game::new();
        play_all(&mut game, &["f2f3", "e7e5", "g2g4", "d8h4"], now);
        assert!(game.is_over());
        assert_eq!(
            play(&mut game, Side::White, "a2a3", now),
            Err(MoveError::Finished)
        );
    }

    #[test]
    fn promotion_defaults_to_queen_and_honours_explicit_choice() {
        let fen = "8/P6k/8/8/8/8/8/K7 w - - 0 1";
        let position: Chess = fen
            .parse::<Fen>()
            .unwrap()
            .into_position(CastlingMode::Standard)
            .unwrap();
        let base = Game {
            position,
            ..Game::new()
        };

        let mut queen = base.clone();
        play(&mut queen, Side::White, "a7a8", Instant::now()).unwrap();
        assert!(queen.fen().starts_with("Q7/"));

        let mut knight = base;
        knight
            .play(
                Side::White,
                sq("a7"),
                sq("a8"),
                parse_promotion(Some('n')),
                Instant::now(),
            )
            .unwrap();
        assert!(knight.fen().starts_with("N7/"));
    }

    #[test]
    fn parses_squares_and_rejects_garbage() {
        assert_eq!(parse_square("e4"), Some(Square::E4));
        assert_eq!(parse_square("z9"), None);
        assert_eq!(parse_promotion(Some('k')), None);
    }
}
