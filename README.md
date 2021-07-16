# Water Levels Programming Test

Deployed to https://evgn.ml/water-levels/

## Differences From The Original Task

Conditions on landscape heights are relaxed. Negative, floating-point numbers and zero are also 
valid heights.

No formal verification. Scarce description of the algorithm.

## Assignment

Write a program in Rust or TypeScript that calculates the water level in different parts of a landscape.

The landscape is defined as positive numbers. Examples: `3,1,6,4,8,9`

```
10 |   |   |   |   |   |   |
 9 |   |   |   |   |   |***|
 8 |   |   |   |   |***|***|
 7 |   |   |   |   |***|***|
 6 |   |   |***|   |***|***|
 5 |   |   |***|   |***|***|
 4 |   |   |***|***|***|***|
 3 |***|   |***|***|***|***|
 2 |***|   |***|***|***|***|
 1 |***|***|***|***|***|***|
   | 1 | 2 | 3 | 4 | 5 | 6 |
```

Then it begins to rain. Per hour one unit of rain falls on each segment of the landscape.

Water that falls on segment 3 in the above sample landscape will flow equally into segment 2 and into segment 4, until segment 4 is filled up to the level of segment 3.

Water that falls on segment 5 will flow into segment 4, because segment 6 is higher. Water that falls on segment 6 will flow into segment 5 (and then further into segment 4) because right to segment 6 is an infinite wall (same as left to segment 1).

To the very left and to the very right of the landscape are infinite walls, i.e. water does not flow outside of the defined landscape.

The program shall calculate the water levels for each segment after x number of hours of rain.

The user of the program shall be able to define the landscape when running the program and shall also be able to define the number of hours it will rain.

Describe an algorithm and its asymptotic computational complexity, including the formal proof of the correctness (i.e. proof by induction or by any other means). The implementation should be done in Rust or TypeScript.

Please deploy the web application to a web-server and provide us a URL, so that we can test it. Furthermore, please attach us a link to the repository (i.e. GitHub, GitLab).

## Test Samples

In one hour a landscape in the first row will turn into new one in the second row (including water):

```
3, 1, 6, 4, 8, 9
4, 4, 6, 6, 8, 9
```

```
1, 2, 3, 4, 5
3⅔, 3⅔, 3⅔, 4, 5
```

```
1, 9, 1
2.5, 9, 2.5
```

```
8, 8, 8, 1
8, 8, 8, 5
```

```
8, 1, 8, 8, 1
8, 4, 8, 8, 3
```

```
1, 8, 9, 8 <- got this one during the sleep and found a critical bug in the algorithm
4, 8, 9, 9 
```

## Algorithm High-Level Description

Computation state is represented in terms of a graph. Nodes of this graph are joined flat parts of the landscape. We’ll call them _inner nodes_. There’re also two additional _bounding_ nodes that represent “infinite walls”.

Nodes are interconnected with two types of edges. First type defines the order of computation. You can think of it like a spine of the graph. It’s a linked list that connects inner nodes in the orderly fashion — from the highest to the lowest. Traversing it in this particular order will help maintain correctness of the algorithm.

Second type of edges connects a node to its directly adjacent landscape neighbors (previous and next). Each inner node has links to exactly 2 neighbors. Bounding nodes have only one edge each, possibly linking to a single node.

Graph node contains some information:

```
segments              # set of links to segments it constitutes of
waterVolume           # amount of non-transferrable water it holds
excessiveWaterVolume  # amount of transferrable water it holds up
baseLevel             # base height for calculating water level above it
```

And from these we can calculate some additional values:

```
width   # cardinality of segments set
level   # current height of the node (base + water above the base level)
```

Bounding nodes have waterVolume = 0, excessiveWaterVolume = -∞, and baseLevel = ∞.

So how all of this solves the original problem?

Basically it’s all about transferring excessive water from node to node, from the higher to the lower regions until it can’t go further. And then fill up those pits with the transferred water, raising their water level until it reaches the level of their neighbors. Then detecting this newly appeared same-level neighbors and greedily merge them together. And then go on from the bottom to the top until all the excessive water ends up in some reservoir.

## Complexity Analysis

Algorithm requires initial sorting of landscape data `O(nlogn)`. And initial merging of the joint same-level neighbors `O(n)`. ~~Further processing is 2-passes down and up the graph spine`O(n)`.~~ (No longer true. Now it's back and forth, until all the water is settled. The total amount of excessive water can only decrease, and it decreases with each pass, because going up the graph requires to fill up pits. Going down on the other hand results in transferring the water to the pits.) This is assuming having a reverse lookup table from segments to graph nodes. And a constant time search inside the graph. So, theoretically, we could end up at  `O(nlogn)`.

Unfortunately, implementation has its shortcomings. Some of them were made for the sake of simplicity. But many of them arise off the desire for using only immutable data structures. This means no mutation by reference is possible. Graph is implemented as a JavaScript array, and no lookup tables implemented, meaning `O(n)` worst-case search (for `n` smaller then some number array works like a hash-map) and this could potentially result in `O(n^2)` behavior of the algorithm. Though I reduces the usage of `indexOf` to 3 times, all of which can be more or less easily eliminated. `findIndex` is used 2 times for getting next and previous neighbors and removing them would require having the aforementioned reverse lookup table.

Testing on both worst-case and randomly generated data, nevertheless, showed very good results. Testing worst case path for landscapes of length 1k-100k showed that doubling sample size results in 4x increase in execution time. This means linear performance for this scale. As for randomly-generated data performance is even better. I guess, it’s because during the computation, graph quickly shrinks down due to the merging of newly appeared same-level neighbors together which helps mitigate some of the `O(n^2)` effects.
