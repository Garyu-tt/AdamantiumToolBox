// The bridge passes {"entry":"main.rs","action":"echo","params":...}.
// This minimal std-only demo forwards raw JSON params without external crates.
use std::io::{self, Read};
#[path = "modules/envelope.rs"]
mod envelope;
fn main() {
    let mut data = String::new();
    io::stdin().read_to_string(&mut data).expect("read request");
    println!("{}", envelope::echo_params(&data).expect("valid bridge frame"));
}
