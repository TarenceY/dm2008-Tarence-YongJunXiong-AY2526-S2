# Reflection — Mini Project: Flappy Bird

Going into this project, I thought having a working physics template to start from would mean most of the hard work was already done. The bird could move, the pipes scrolled, and collisions were handled — on paper, it was functional. But functional and fun are very different things, and closing that gap turned out to be where most of my effort went.

The biggest challenge was making the bird feel like an actual character rather than just a bouncing ball. At the start, the bird was literally just a circle. Swapping in a sprite helped, but it still felt lifeless because it didn't react to what it was doing. It just moved up and down stiffly. Getting the bird to tilt upward when flapping and nose-dive when falling made an enormous difference to how the game felt. It sounds like a small detail, but without it the game felt like a physics demo rather than something you actually want to play.

Sound effects were another thing I underestimated. Adding a flap sound and a game over sound shifted the feel of the game significantly — even though nothing about the core mechanics changed. It made actions feel like they had weight. The high score system using localStorage was also new to me in a games context, and it added a sense of progression that kept me actually testing the game rather than just running it once and moving on.

Looking back, I think the biggest thing I took away is that polish matters more than I expected. The template gave us a game, but the decisions we made on top of it — the sprite, the rotation, the sounds — are what made it feel like our game.

