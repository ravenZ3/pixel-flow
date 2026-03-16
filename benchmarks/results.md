## v2 navive re-execution timeline

date: 15/03/2026
image: 3840x2161
node count: 6
trigger: colornode brightness slider
pipline: ImageInput → CannyEdge → ASCII → Blend → Color → Output

results(ms):
run 1: 4996
run 2: 4261
run 3: 3246
run 4: 3566
run 5: 3853
run 6: 3874
run 7: 3968
run 8: 3544
run 9: 3182
run 10: 3813
run 11: 3744
run 12: 3353


Average: 3614ms
Min:     3182ms  (run 9)
Max:     3968ms  (run 10, excluding cold start)
Cold start (run 1): 4996ms


## V2.1 Dirty Flag Caching
Date: 15/03/2026
Image: 3840x2161
Node count: 6
Trigger: ColorNode brightness slider (mid-pipeline change)
Pipeline: ImageInput → CannyEdge → ASCII → Blend → Color → Output

results(ms):
run 1: 4098
run 2: 1067
run 3: 997
run 4: 1253
run 5: 926
run 6: 1282
run 7: 994
run 8: 1006
run 9: 1027
run 10: 1331

Average:  1098ms
Min:      926ms   (run 5)
Max:      1331ms  (run 10)
Cold start (run 1): 4098ms


## comparison
V2 naive average:    3614ms
V2.1 average:        1098ms
Reduction:           2516ms
Percentage:          69.6% faster

// Reduced pipeline execution time by 69.6% on a 6-node
4K image processing graph by implementing dirty-flag
caching with topological propagation — from 3614ms
to 1098ms average for mid-pipeline changes