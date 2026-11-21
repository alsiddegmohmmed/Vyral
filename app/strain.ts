// The poses use the same curve commands so the silhouette can morph as one path.
const silhouette = `M91 42
  C107 28 113 22 137 24
  C157 26 179 20 197 33
  C217 48 209 72 214 91
  C217 108 238 116 240 139
  C242 159 223 174 210 191
  C196 209 196 232 171 233
  C156 234 144 228 127 232
  C104 238 91 229 79 215
  C64 199 53 199 39 194
  C17 187 12 169 18 148
  C26 122 14 103 22 80
  C31 57 65 62 91 42 Z`;

const expanded = `M86 42
  C104 27 113 13 139 20
  C160 26 185 12 207 27
  C227 43 216 70 221 90
  C224 108 249 116 248 139
  C247 161 225 180 215 198
  C204 216 197 240 173 239
  C157 238 140 233 125 240
  C102 249 86 232 72 217
  C58 201 43 206 32 198
  C15 187 8 170 16 148
  C25 124 8 104 17 78
  C25 53 60 64 86 42 Z`;

const recoil = `M94 43
  C111 33 117 30 139 29
  C158 27 179 28 193 39
  C209 52 202 76 209 93
  C215 112 229 119 232 139
  C235 157 218 172 205 189
  C193 206 192 226 172 226
  C154 226 140 221 126 227
  C106 236 92 223 83 211
  C69 194 57 195 44 189
  C23 181 19 165 24 148
  C30 127 19 107 27 85
  C36 63 72 57 94 43 Z`;

// Keep the circular cutout fixed as the perimeter changes.
const aperture = 'M177 97 A17 17 0 1 0 143 97 A17 17 0 1 0 177 97 Z';

export const strainMark = `${silhouette} ${aperture}`;
export const strainPulse = [silhouette, expanded, recoil, silhouette]
  .map(pose => `${pose} ${aperture}`)
  .join(';');
