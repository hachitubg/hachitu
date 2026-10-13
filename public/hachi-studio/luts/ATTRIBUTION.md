# RawTherapee Film Simulation LUTs

Authors: Pat David, Pavlov Dmitry, Michael Ezra.
Source collection: RawTherapee Film Simulation Collection, 2015-09-20.
License for the LUT data and these derived PNG files: CC BY-SA 4.0.
https://creativecommons.org/licenses/by-sa/4.0/

Distributed through https://github.com/cedeber/hald-clut at revision
`3b3180f82d4dcea1e6e8c5648473539a910d7f49`.
Source path: `HaldCLUT/Film Simulation/`; the unmodified collection notice is
included in `SOURCE-LICENSE.txt`.

Modified by HACHITU: original Hald tables were resampled using trilinear
interpolation to a 32x32x32 RGB grid, flattened red-first into 256x128 PNGs.
This conversion reduces download and GPU memory use; it does not resize a
Hald image as an ordinary photo. Output is 8-bit sRGB. The converted files
remain licensed CC BY-SA 4.0. They are approximate film simulations, not
official manufacturer profiles or endorsements.

The reproducible source filenames and conversion implementation are in
`src/views/hachi-studio/tools/prepare-luts.mjs`. No source software from the
repository is incorporated; only the separately licensed LUT data is used.
