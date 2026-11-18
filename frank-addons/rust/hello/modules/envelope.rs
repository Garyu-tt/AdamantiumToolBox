// Example-specific parser for the trusted bridge frame, not a general JSON parser.
// Production Rust addons should vendor/compile their own JSON handling library.
pub fn echo_params(request: &str) -> Result<String, &'static str> {
    let marker = ",\"params\":";
    let start = request.find(marker).ok_or("missing params")? + marker.len();
    let value = request[start..].trim_end();
    let params = value.strip_suffix('}').ok_or("missing frame end")?;
    if params.is_empty() { return Err("missing payload"); }
    Ok(format!("{{\"result\":{params}}}"))
}
