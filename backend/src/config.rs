use std::{
    env::{self, VarError},
    net::SocketAddr,
    path::PathBuf,
};

const DEFAULT_BIND_ADDR: &str = "0.0.0.0:8080";

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("BIND_ADDR inválido: {0}")]
    BindAddr(#[from] std::net::AddrParseError),
    #[error("variável de ambiente {0} não é UTF-8 válido")]
    NotUnicode(&'static str),
}

#[derive(Debug, Clone)]
pub struct Config {
    pub bind_addr: SocketAddr,
    pub static_dir: Option<PathBuf>,
}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        let bind_addr = read("BIND_ADDR")?
            .as_deref()
            .unwrap_or(DEFAULT_BIND_ADDR)
            .parse()?;
        let static_dir = read("STATIC_DIR")?.map(PathBuf::from);

        Ok(Self {
            bind_addr,
            static_dir,
        })
    }
}

fn read(key: &'static str) -> Result<Option<String>, ConfigError> {
    match env::var(key) {
        Ok(value) if !value.is_empty() => Ok(Some(value)),
        Ok(_) | Err(VarError::NotPresent) => Ok(None),
        Err(VarError::NotUnicode(_)) => Err(ConfigError::NotUnicode(key)),
    }
}
